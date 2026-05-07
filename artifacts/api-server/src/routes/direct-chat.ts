import { Router } from "express";
import { db } from "@workspace/db";
import {
  chatConversationsTable,
  chatMessagesTable,
  usersTable,
  storesTable,
  ordersTable,
} from "@workspace/db/schema";
import { eq, and, or, desc, asc, ilike, sql } from "drizzle-orm";
import { authenticate, type AuthRequest } from "../middlewares/authenticate.js";
import { participantRole } from "../lib/messaging.js";
import { getIO } from "../socket/index.js";
import { createNotification } from "./notifications.js";

const router = Router();
router.use(authenticate);

// ── Helpers ───────────────────────────────────────────────────────────

async function loadConversation(id: string) {
  const [conv] = await db
    .select()
    .from(chatConversationsTable)
    .where(eq(chatConversationsTable.id, id))
    .limit(1);
  return conv ?? null;
}

function emitToConversationAllNs(
  conversationId: string,
  event: string,
  payload: unknown,
  conv: {
    adminId: string | null;
    storeId: string | null;
    storeOwnerId: string | null;
    customerId: string | null;
  }
) {
  const io = getIO();
  if (!io) return;
  // Broadcast to conversation room across all 3 namespaces.
  io.of("/customer").to(`conversation:${conversationId}`).emit(event, payload);
  io.of("/store").to(`conversation:${conversationId}`).emit(event, payload);
  io.of("/admin").to(`conversation:${conversationId}`).emit(event, payload);
  // Also fan out to participant "inbox" rooms so unsubscribed clients still
  // get a notification badge update on their conversation list.
  if (conv.customerId) {
    io.of("/customer")
      .to(`user:${conv.customerId}`)
      .emit("direct_message_inbox", payload);
  }
  if (conv.storeId) {
    io.of("/store").to(`store:${conv.storeId}`).emit("direct_message_inbox", payload);
  }
  // For admin↔store conversations, storeId is null — notify the store owner
  // directly via their personal user room on the /store namespace.
  if (conv.storeOwnerId) {
    io.of("/store")
      .to(`user:${conv.storeOwnerId}`)
      .emit("direct_message_inbox", payload);
  }
  io.of("/admin").to("admin_global").emit("direct_message_inbox", payload);
}

// ── GET /api/direct-chat/conversations ────────────────────────────────
// List conversations the current user participates in.
router.get("/conversations", async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const role = req.user!.role;

    let where;
    if (role === "ADMIN") {
      where = eq(chatConversationsTable.adminId, userId);
    } else if (role === "STORE_OWNER" || role === "STORE_STAFF") {
      where = eq(chatConversationsTable.storeOwnerId, userId);
    } else {
      where = eq(chatConversationsTable.customerId, userId);
    }

    const convs = await db
      .select({
        id: chatConversationsTable.id,
        type: chatConversationsTable.type,
        adminId: chatConversationsTable.adminId,
        storeId: chatConversationsTable.storeId,
        storeOwnerId: chatConversationsTable.storeOwnerId,
        customerId: chatConversationsTable.customerId,
        lastMessageAt: chatConversationsTable.lastMessageAt,
        lastMessageText: chatConversationsTable.lastMessageText,
      })
      .from(chatConversationsTable)
      .where(where)
      .orderBy(desc(chatConversationsTable.lastMessageAt))
      .limit(100);

    // Hydrate counterparty display info
    const userIds = new Set<string>();
    const storeIds = new Set<string>();
    for (const c of convs) {
      if (c.adminId) userIds.add(c.adminId);
      if (c.customerId) userIds.add(c.customerId);
      if (c.storeOwnerId) userIds.add(c.storeOwnerId);
      if (c.storeId) storeIds.add(c.storeId);
    }
    const usersList = userIds.size
      ? await db
          .select({
            id: usersTable.id,
            firstName: usersTable.firstName,
            lastName: usersTable.lastName,
            email: usersTable.email,
            role: usersTable.role,
          })
          .from(usersTable)
          .where(sql`${usersTable.id} IN ${Array.from(userIds)}`)
      : [];
    const storesList = storeIds.size
      ? await db
          .select({ id: storesTable.id, name: storesTable.name })
          .from(storesTable)
          .where(sql`${storesTable.id} IN ${Array.from(storeIds)}`)
      : [];
    const userMap = new Map(usersList.map((u) => [u.id, u]));
    const storeMap = new Map(storesList.map((s) => [s.id, s]));

    const enriched = convs.map((c) => {
      // Pick counterparty user based on the viewer's role and the conversation type.
      let counterpartyUser;
      if (role === "ADMIN") {
        counterpartyUser = userMap.get((c.customerId || c.storeOwnerId)!);
      } else if (role === "CUSTOMER") {
        counterpartyUser = userMap.get((c.adminId || c.storeOwnerId)!);
      } else {
        // Store owner / staff: counterpart is admin (admin_store) or customer (store_customer)
        counterpartyUser = userMap.get((c.adminId || c.customerId)!);
      }

      // Display name preference:
      //   - Customer viewing a store_customer conv → store name (more recognizable)
      //   - Everyone else → person name
      const showStoreName = role === "CUSTOMER" && c.storeId;
      const counterpartyName = showStoreName
        ? storeMap.get(c.storeId!)?.name
        : counterpartyUser
        ? `${counterpartyUser.firstName} ${counterpartyUser.lastName}`.trim()
        : "User";

      return {
        ...c,
        counterpartyName,
        counterpartyEmail: counterpartyUser?.email,
        counterpartyRole: counterpartyUser?.role,
      };
    });

    res.json(enriched);
  } catch (err) {
    console.error("List direct conversations error", err);
    res.status(500).json({ error: "ServerError" });
  }
});

// ── GET /api/direct-chat/conversations/:id/messages ───────────────────
router.get("/conversations/:id/messages", async (req: AuthRequest, res) => {
  try {
    const conv = await loadConversation(req.params.id);
    if (!conv) {
      res.status(404).json({ error: "NotFound" });
      return;
    }
    if (!participantRole(conv, req.user!.userId, req.user!.role)) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    const messages = await db
      .select()
      .from(chatMessagesTable)
      .where(eq(chatMessagesTable.conversationId, conv.id))
      .orderBy(asc(chatMessagesTable.createdAt));
    res.json(messages);
  } catch (err) {
    console.error("Get direct messages error", err);
    res.status(500).json({ error: "ServerError" });
  }
});

// ── POST /api/direct-chat/conversations/:id/messages ──────────────────
router.post("/conversations/:id/messages", async (req: AuthRequest, res) => {
  try {
    const conv = await loadConversation(req.params.id);
    if (!conv) {
      res.status(404).json({ error: "NotFound" });
      return;
    }
    const senderRole = participantRole(conv, req.user!.userId, req.user!.role);
    if (!senderRole) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    const content = String(req.body?.content || "").trim();
    if (!content) {
      res.status(400).json({ error: "ValidationError", message: "Empty content" });
      return;
    }
    const [msg] = await db
      .insert(chatMessagesTable)
      .values({
        conversationId: conv.id,
        senderId: req.user!.userId,
        senderRole,
        content,
      })
      .returning();

    await db
      .update(chatConversationsTable)
      .set({ lastMessageAt: new Date(), lastMessageText: content })
      .where(eq(chatConversationsTable.id, conv.id));

    try {
      emitToConversationAllNs(conv.id, "new_direct_message", msg, conv);

      // Notify the other participant(s)
      const notifTitle = "New Message";
      const notifBody = content.length > 80 ? content.slice(0, 80) + "…" : content;
      const notifData = { conversationId: conv.id };

      if (senderRole === "CUSTOMER") {
        if (conv.storeOwnerId) createNotification(conv.storeOwnerId, "NEW_MESSAGE", notifTitle, notifBody, notifData).catch(() => {});
        if (conv.adminId) createNotification(conv.adminId, "NEW_MESSAGE", notifTitle, notifBody, notifData).catch(() => {});
      } else if (senderRole === "STORE_OWNER") {
        if (conv.customerId) createNotification(conv.customerId, "NEW_MESSAGE", notifTitle, notifBody, notifData).catch(() => {});
        if (conv.adminId) createNotification(conv.adminId, "NEW_MESSAGE", notifTitle, notifBody, notifData).catch(() => {});
      } else if (senderRole === "ADMIN") {
        if (conv.customerId) createNotification(conv.customerId, "NEW_MESSAGE", notifTitle, notifBody, notifData).catch(() => {});
        if (conv.storeOwnerId) createNotification(conv.storeOwnerId, "NEW_MESSAGE", notifTitle, notifBody, notifData).catch(() => {});
      }
    } catch (e) {
      console.error("emit direct message failed", e);
    }

    res.status(201).json(msg);
  } catch (err) {
    console.error("Send direct message error", err);
    res.status(500).json({ error: "ServerError" });
  }
});

// ── POST /api/direct-chat/start ───────────────────────────────────────
// Body: { recipientUserId } — caller's role + recipient's role determine the
// conversation type. Idempotent: returns the existing conv if one exists.
router.post("/start", async (req: AuthRequest, res) => {
  try {
    const { recipientUserId } = req.body || {};
    if (!recipientUserId || typeof recipientUserId !== "string") {
      res.status(400).json({ error: "ValidationError", message: "recipientUserId required" });
      return;
    }
    if (recipientUserId === req.user!.userId) {
      res.status(400).json({ error: "ValidationError", message: "Cannot message yourself" });
      return;
    }

    const [recipient] = await db
      .select({ id: usersTable.id, role: usersTable.role })
      .from(usersTable)
      .where(eq(usersTable.id, recipientUserId))
      .limit(1);
    if (!recipient) {
      res.status(404).json({ error: "NotFound", message: "Recipient not found" });
      return;
    }

    const callerRole = req.user!.role;
    const callerId = req.user!.userId;

    let convType: string;
    let adminId: string | null = null;
    let customerId: string | null = null;
    let storeOwnerId: string | null = null;
    let storeId: string | null = null;

    if (callerRole === "ADMIN") {
      adminId = callerId;
      if (recipient.role === "CUSTOMER") {
        convType = "admin_customer";
        customerId = recipient.id;
      } else if (recipient.role === "STORE_OWNER" || recipient.role === "STORE_STAFF") {
        convType = "admin_store";
        storeOwnerId = recipient.id;
      } else {
        res.status(400).json({ error: "ValidationError", message: "Cannot start admin↔admin chat" });
        return;
      }
    } else if (callerRole === "STORE_OWNER" || callerRole === "STORE_STAFF") {
      const [store] = await db
        .select({ id: storesTable.id })
        .from(storesTable)
        .where(eq(storesTable.ownerId, callerId))
        .limit(1);
      if (!store) {
        res.status(400).json({ error: "NoStore" });
        return;
      }
      storeOwnerId = callerId;
      storeId = store.id;
      if (recipient.role === "CUSTOMER") {
        convType = "store_customer";
        customerId = recipient.id;
      } else if (recipient.role === "ADMIN") {
        convType = "admin_store";
        adminId = recipient.id;
        storeId = null; // admin↔store conv is keyed by storeOwnerId, not storeId
      } else {
        res.status(400).json({ error: "ValidationError" });
        return;
      }
    } else {
      // Customer starting a chat: allowed only with admin (for support) or a store.
      customerId = callerId;
      if (recipient.role === "ADMIN") {
        convType = "admin_customer";
        adminId = recipient.id;
      } else if (recipient.role === "STORE_OWNER") {
        const [store] = await db
          .select({ id: storesTable.id })
          .from(storesTable)
          .where(eq(storesTable.ownerId, recipient.id))
          .limit(1);
        if (!store) {
          res.status(400).json({ error: "NoStore" });
          return;
        }
        convType = "store_customer";
        storeOwnerId = recipient.id;
        storeId = store.id;
      } else {
        res.status(400).json({ error: "ValidationError" });
        return;
      }
    }

    // Idempotent lookup
    const conds = [eq(chatConversationsTable.type, convType)];
    if (adminId) conds.push(eq(chatConversationsTable.adminId, adminId));
    if (customerId) conds.push(eq(chatConversationsTable.customerId, customerId));
    if (storeOwnerId) conds.push(eq(chatConversationsTable.storeOwnerId, storeOwnerId));
    if (storeId) conds.push(eq(chatConversationsTable.storeId, storeId));

    const [existing] = await db
      .select()
      .from(chatConversationsTable)
      .where(and(...conds))
      .limit(1);
    if (existing) {
      res.json(existing);
      return;
    }

    const [conv] = await db
      .insert(chatConversationsTable)
      .values({
        type: convType,
        adminId,
        customerId,
        storeOwnerId,
        storeId,
      })
      .returning();
    res.status(201).json(conv);
  } catch (err) {
    console.error("Start direct conversation error", err);
    res.status(500).json({ error: "ServerError" });
  }
});

// ── GET /api/direct-chat/admin/users — admin-only directory ──────────
router.get("/admin/users", async (req: AuthRequest, res) => {
  try {
    if (req.user!.role !== "ADMIN") {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    const search = String(req.query.search || "").trim();
    const roleFilter = String(req.query.role || "").trim().toUpperCase();

    const conds = [];
    if (search) {
      const pattern = `%${search}%`;
      conds.push(
        or(
          ilike(usersTable.email, pattern),
          ilike(usersTable.firstName, pattern),
          ilike(usersTable.lastName, pattern)
        )!
      );
    }
    if (roleFilter && ["CUSTOMER", "STORE_OWNER", "STORE_STAFF"].includes(roleFilter)) {
      conds.push(eq(usersTable.role, roleFilter as any));
    } else {
      // exclude other admins by default
      conds.push(sql`${usersTable.role} <> 'ADMIN'`);
    }

    const users = await db
      .select({
        id: usersTable.id,
        firstName: usersTable.firstName,
        lastName: usersTable.lastName,
        email: usersTable.email,
        role: usersTable.role,
      })
      .from(usersTable)
      .where(conds.length ? and(...conds) : undefined)
      .orderBy(desc(usersTable.createdAt))
      .limit(50);
    res.json(users);
  } catch (err) {
    console.error("Admin users dir error", err);
    res.status(500).json({ error: "ServerError" });
  }
});

// ── GET /api/direct-chat/store/customers — store-owner directory ──────
router.get("/store/customers", async (req: AuthRequest, res) => {
  try {
    const role = req.user!.role;
    if (role !== "STORE_OWNER" && role !== "STORE_STAFF" && role !== "ADMIN") {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    const [store] = await db
      .select({ id: storesTable.id })
      .from(storesTable)
      .where(eq(storesTable.ownerId, req.user!.userId))
      .limit(1);
    if (!store) {
      res.status(404).json({ error: "NoStore" });
      return;
    }
    const search = String(req.query.search || "").trim();

    const customerRows = await db
      .selectDistinct({
        id: usersTable.id,
        firstName: usersTable.firstName,
        lastName: usersTable.lastName,
        email: usersTable.email,
      })
      .from(ordersTable)
      .innerJoin(usersTable, eq(usersTable.id, ordersTable.customerId))
      .where(
        and(
          eq(ordersTable.storeId, store.id),
          search
            ? or(
                ilike(usersTable.email, `%${search}%`),
                ilike(usersTable.firstName, `%${search}%`),
                ilike(usersTable.lastName, `%${search}%`)
              )!
            : undefined
        )
      )
      .limit(100);
    res.json(customerRows);
  } catch (err) {
    console.error("Store customers dir error", err);
    res.status(500).json({ error: "ServerError" });
  }
});

export default router;
