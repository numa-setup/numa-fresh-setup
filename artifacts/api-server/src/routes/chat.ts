import { Router } from "express";
import { db } from "@workspace/db";
import { orderChatMessagesTable } from "@workspace/db/schema";
import { ordersTable, storesTable } from "@workspace/db/schema";
import { eq, and, asc, desc } from "drizzle-orm";
import { authenticate, AuthRequest } from "../middlewares/authenticate.js";

const router = Router();
router.use(authenticate);

// GET /api/chat/:orderId/messages — fetch chat history for an order
router.get("/:orderId/messages", async (req: AuthRequest, res) => {
  try {
    const { orderId } = req.params;
    const userId = req.user!.userId;
    const role = req.user!.role;

    // Verify access: customer owns order, or store owns order, or admin
    if (role !== "ADMIN") {
      const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, orderId)).limit(1);
      if (!order) { res.status(404).json({ error: "Order not found" }); return; }

      if (role === "CUSTOMER" && order.customerId !== userId) {
        res.status(403).json({ error: "Forbidden" }); return;
      }
      if (role === "STORE_OWNER" || role === "STORE_STAFF") {
        const [store] = await db.select().from(storesTable).where(eq(storesTable.ownerId, userId)).limit(1);
        if (!store || order.storeId !== store.id) {
          res.status(403).json({ error: "Forbidden" }); return;
        }
      }
    }

    const messages = await db.select()
      .from(orderChatMessagesTable)
      .where(eq(orderChatMessagesTable.orderId, orderId))
      .orderBy(asc(orderChatMessagesTable.createdAt));

    res.json(messages);
  } catch (err) {
    console.error("Get chat messages error", err);
    res.status(500).json({ error: "ServerError" });
  }
});

// POST /api/chat/:orderId/messages — send a chat message
router.post("/:orderId/messages", async (req: AuthRequest, res) => {
  try {
    const { orderId } = req.params;
    const { content, messageType = "text" } = req.body;
    const userId = req.user!.userId;
    const role = req.user!.role as string;

    if (!content || !content.trim()) {
      res.status(400).json({ error: "Content required" }); return;
    }

    // Verify access
    const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, orderId)).limit(1);
    if (!order) { res.status(404).json({ error: "Order not found" }); return; }

    if (role === "CUSTOMER" && order.customerId !== userId) {
      res.status(403).json({ error: "Forbidden" }); return;
    }

    // Determine sender name
    let senderName = role === "ADMIN" ? "Admin" : role === "STORE_OWNER" ? "Store" : "Customer";
    const senderRole = (role === "ADMIN" ? "ADMIN" : role === "STORE_OWNER" ? "STORE_OWNER" : "CUSTOMER") as any;

    const [msg] = await db.insert(orderChatMessagesTable).values({
      orderId,
      senderId: userId,
      senderRole,
      senderName,
      content: content.trim(),
      messageType,
    }).returning();

    res.status(201).json(msg);
  } catch (err) {
    console.error("Post chat message error", err);
    res.status(500).json({ error: "ServerError" });
  }
});

// GET /api/chat/admin/conversations — admin sees all active chats
router.get("/admin/conversations", async (req: AuthRequest, res) => {
  try {
    if (req.user!.role !== "ADMIN") { res.status(403).json({ error: "Forbidden" }); return; }

    // Get orders with recent messages
    const recentMessages = await db.select({
      orderId: orderChatMessagesTable.orderId,
      lastMessage: orderChatMessagesTable.content,
      lastAt: orderChatMessagesTable.createdAt,
      senderRole: orderChatMessagesTable.senderRole,
    })
    .from(orderChatMessagesTable)
    .orderBy(desc(orderChatMessagesTable.createdAt))
    .limit(50);

    // Group by orderId keeping only the latest
    const seen = new Set<string>();
    const convos = recentMessages.filter(m => {
      if (seen.has(m.orderId)) return false;
      seen.add(m.orderId);
      return true;
    });

    res.json(convos);
  } catch (err) {
    console.error("Admin convos error", err);
    res.status(500).json({ error: "ServerError" });
  }
});

// GET /api/chat/store/conversations — store owner sees all their order chats
router.get("/store/conversations", async (req: AuthRequest, res) => {
  try {
    const role = req.user!.role;
    if (role !== "STORE_OWNER" && role !== "ADMIN") {
      res.status(403).json({ error: "Forbidden" }); return;
    }

    const [store] = await db.select().from(storesTable).where(eq(storesTable.ownerId, req.user!.userId)).limit(1);
    if (!store) { res.status(404).json({ error: "NoStore" }); return; }

    // Get orders for this store with chat messages
    const orders = await db.select({
      id: ordersTable.id,
      status: ordersTable.status,
      createdAt: ordersTable.createdAt,
    }).from(ordersTable).where(eq(ordersTable.storeId, store.id)).orderBy(desc(ordersTable.createdAt)).limit(30);

    const orderIds = orders.map(o => o.id);
    if (orderIds.length === 0) { res.json([]); return; }

    const messages = await db.select()
      .from(orderChatMessagesTable)
      .where(eq(orderChatMessagesTable.orderId, orderIds[0]))
      .orderBy(desc(orderChatMessagesTable.createdAt))
      .limit(1);

    res.json(orders.map(o => ({
      orderId: o.id,
      orderStatus: o.status,
      createdAt: o.createdAt,
    })));
  } catch (err) {
    console.error("Store convos error", err);
    res.status(500).json({ error: "ServerError" });
  }
});

export default router;
