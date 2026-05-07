import { Server as SocketIOServer } from "socket.io";
import type { Server as HttpServer } from "node:http";
import { logger } from "../lib/logger.js";
import { verifyAccessToken } from "../lib/auth.js";
import { db } from "@workspace/db";
import { ordersTable, storesTable, usersTable, orderChatMessagesTable, chatConversationsTable, chatMessagesTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";

interface SocketUser {
  userId: string;
  email: string;
  role: string;
}

interface AuthSocket {
  user?: SocketUser;
}

// Use the same access-token secret + verifier the REST API uses,
// so JWTs issued by /api/auth/login are accepted on Socket.IO too.
async function verifyToken(token: string): Promise<SocketUser | null> {
  try {
    const decoded = verifyAccessToken(token);
    return { userId: decoded.userId, email: decoded.email, role: decoded.role };
  } catch {
    return null;
  }
}

async function verifyStoreOwnership(userId: string, storeId: string): Promise<boolean> {
  try {
    const owner = await db.select({ id: storesTable.id })
      .from(storesTable)
      .where(and(eq(storesTable.id, storeId), eq(storesTable.ownerId, userId)))
      .limit(1);
    return owner.length > 0;
  } catch {
    return false;
  }
}

export function initSocketIO(httpServer: HttpServer): SocketIOServer {
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: process.env.FRONTEND_URL || true,
      credentials: true,
    },
    transports: ["websocket", "polling"],
  });

  // ── /customer namespace ──────────────────────────────────────
  const customerNs = io.of("/customer");

  // Customer auth is optional — unauthenticated users can still receive broadcasts
  customerNs.use(async (socket, next) => {
    const token = socket.handshake.auth.token || socket.handshake.headers["authorization"]?.replace("Bearer ", "");
    if (token) {
      const user = await verifyToken(token);
      if (user) (socket as AuthSocket & typeof socket).user = user;
    }
    next();
  });

  customerNs.on("connection", (socket) => {
    const user = (socket as AuthSocket & typeof socket).user;
    if (user) {
      logger.info({ userId: user.userId }, "Customer socket connected");
      // Join personal room for targeted events
      socket.join(`user:${user.userId}`);
    }

    socket.on("join_order", async (orderId: string) => {
      if (!user) return;
      const order = await db.select({ id: ordersTable.id, customerId: ordersTable.customerId })
        .from(ordersTable).where(eq(ordersTable.id, orderId)).limit(1);
      if (order[0]?.customerId === user.userId) {
        await socket.join(`order:${orderId}`);
      }
    });

    // Join chat conversation room
    socket.on("join_conversation", async (conversationId: string) => {
      if (!user) return;
      // Verify user is participant
      const conv = await db.select({ id: chatConversationsTable.id, customerId: chatConversationsTable.customerId })
        .from(chatConversationsTable)
        .where(and(eq(chatConversationsTable.id, conversationId), eq(chatConversationsTable.customerId, user.userId)))
        .limit(1);
      if (conv[0]) {
        await socket.join(`conversation:${conversationId}`);
      }
    });

    socket.on("send_message", async (data: { orderId: string; message: string }) => {
      if (!user) return;
      const { orderId, message } = data;
      if (!message?.trim()) return;
      const order = await db.select({ id: ordersTable.id, customerId: ordersTable.customerId, storeId: ordersTable.storeId })
        .from(ordersTable).where(eq(ordersTable.id, orderId)).limit(1);
      if (!order[0] || order[0].customerId !== user.userId) return;
      try {
        await db.insert(orderChatMessagesTable).values({
          orderId, senderId: user.userId, senderRole: "CUSTOMER", senderName: "Customer", content: message.trim(),
        });
      } catch (e) { logger.error({ e }, "Failed to persist customer message"); }
      const msgData = { orderId, message: message.trim(), from: "customer", userId: user.userId, senderRole: "CUSTOMER", timestamp: new Date().toISOString() };
      io.of("/store").to(`order:${orderId}`).emit("new_message", msgData);
      socket.emit("message_sent", msgData);
    });

    socket.on("substitution_response", async (data: { orderId: string; itemId: string; accepted: boolean }) => {
      const { orderId, accepted } = data;
      io.of("/store").to(`order:${orderId}`).emit(accepted ? "substitution_approved" : "substitution_rejected", {
        orderId, ...data, timestamp: new Date().toISOString(),
      });
      socket.emit("substitution_response_sent", { accepted });
    });

    socket.on("im_here_curbside", async (data: { orderId: string; vehicleInfo?: string }) => {
      const order = await db.select({ storeId: ordersTable.storeId })
        .from(ordersTable).where(eq(ordersTable.id, data.orderId)).limit(1);
      if (!order[0]) return;
      io.of("/store").to(`order:${data.orderId}`).emit("customer_arrived", {
        orderId: data.orderId,
        vehicleInfo: data.vehicleInfo,
        customerName: user?.email,
        timestamp: new Date().toISOString(),
      });
    });

    socket.on("disconnect", () => {
      if (user) {
        logger.info({ userId: user.userId }, "Customer socket disconnected");
        io.of("/admin").to("admin_global").emit("user_offline", { userId: user.userId });
      }
    });
  });

  // ── /store namespace ──────────────────────────────────────
  const storeNs = io.of("/store");

  storeNs.use(async (socket, next) => {
    const token = socket.handshake.auth.token || socket.handshake.headers["authorization"]?.replace("Bearer ", "");
    if (!token) return next(new Error("Authentication required"));
    const user = await verifyToken(token);
    if (!user || !["STORE_OWNER", "STORE_STAFF", "ADMIN"].includes(user.role)) {
      return next(new Error("Unauthorized"));
    }
    (socket as AuthSocket & typeof socket).user = user;
    next();
  });

  storeNs.on("connection", async (socket) => {
    const user = (socket as AuthSocket & typeof socket).user!;
    logger.info({ userId: user.userId }, "Store socket connected");

    // Personal room for direct-chat inbox events targeted at this owner
    // (e.g. admin_store conversations have no storeId, so we route by user).
    await socket.join(`user:${user.userId}`);

    // Auto-join all rooms this owner has stores in, so server-side `emitToStore(storeId, ...)`
    // (e.g. new_order, product_approved, store_status_changed) reaches them without
    // requiring the client to coordinate a join_store call.
    try {
      const ownedStores = await db
        .select({ id: storesTable.id })
        .from(storesTable)
        .where(eq(storesTable.ownerId, user.userId));
      for (const s of ownedStores) {
        await socket.join(`store:${s.id}`);
      }
      if (ownedStores.length > 0) {
        logger.info({ userId: user.userId, count: ownedStores.length }, "Auto-joined store rooms");
      }
    } catch (e) {
      logger.error({ e }, "Failed to auto-join store rooms");
    }

    socket.on("join_store", async (storeId: string) => {
      const isOwner = await verifyStoreOwnership(user.userId, storeId);
      if (isOwner || user.role === "ADMIN") {
        await socket.join(`store:${storeId}`);
        logger.info({ storeId }, "Store joined room");
      }
    });

    socket.on("join_order", async (orderId: string) => {
      await socket.join(`order:${orderId}`);
    });

    // Join chat conversation room — only if this user is the storeOwner participant.
    // Global ADMIN role does NOT bypass membership; admins use the /admin namespace.
    socket.on("join_conversation", async (conversationId: string) => {
      const conv = await db.select({ id: chatConversationsTable.id, storeOwnerId: chatConversationsTable.storeOwnerId })
        .from(chatConversationsTable)
        .where(and(eq(chatConversationsTable.id, conversationId), eq(chatConversationsTable.storeOwnerId, user.userId)))
        .limit(1);
      if (conv[0]) {
        await socket.join(`conversation:${conversationId}`);
      }
    });

    socket.on("order_status_update", async (data: { orderId: string; status: string; message?: string }) => {
      const { orderId, status, message } = data;
      try {
        await db.update(ordersTable)
          .set({ status: status as any, updatedAt: new Date() } as any)
          .where(eq(ordersTable.id, orderId));
      } catch { /* status might not be valid, handled by DB */ }
      customerNs.to(`order:${orderId}`).emit("order_status", {
        orderId, status, message, timestamp: new Date().toISOString(),
      });
      io.of("/admin").to("admin_global").emit("order_status_changed", { orderId, status });
    });

    socket.on("substitution_request", (data: { orderId: string; originalItem: string; substituteItem: string; substitutePrice: number }) => {
      customerNs.to(`order:${data.orderId}`).emit("substitution_request", {
        ...data, timestamp: new Date().toISOString(),
      });
    });

    socket.on("send_message", async (data: { orderId: string; message: string; storeId: string }) => {
      if (!data.message?.trim()) return;
      try {
        await db.insert(orderChatMessagesTable).values({
          orderId: data.orderId, senderId: user.userId, senderRole: "STORE_OWNER", senderName: "Store", content: data.message.trim(),
        });
      } catch (e) { logger.error({ e }, "Failed to persist store message"); }
      const msgData = { ...data, message: data.message.trim(), from: "store", senderRole: "STORE_OWNER", timestamp: new Date().toISOString() };
      customerNs.to(`order:${data.orderId}`).emit("new_message", msgData);
      socket.emit("message_sent", msgData);
    });

    socket.on("mark_ready", async (data: { orderId: string; qrCode?: string }) => {
      await db.update(ordersTable)
        .set({ status: "READY_FOR_PICKUP", updatedAt: new Date() } as any)
        .where(eq(ordersTable.id, data.orderId));
      customerNs.to(`order:${data.orderId}`).emit("order_ready", {
        orderId: data.orderId,
        qrCode: data.qrCode,
        timestamp: new Date().toISOString(),
      });
    });

    socket.on("curbside_delivered", async (data: { orderId: string }) => {
      await db.update(ordersTable)
        .set({ status: "COMPLETED", updatedAt: new Date() } as any)
        .where(eq(ordersTable.id, data.orderId));
      customerNs.to(`order:${data.orderId}`).emit("order_status", {
        orderId: data.orderId, status: "COMPLETED", timestamp: new Date().toISOString(),
      });
    });

    socket.on("disconnect", () => {
      logger.info({ userId: user.userId }, "Store socket disconnected");
    });
  });

  // ── /admin namespace ──────────────────────────────────────
  const adminNs = io.of("/admin");

  adminNs.use(async (socket, next) => {
    const token = socket.handshake.auth.token || socket.handshake.headers["authorization"]?.replace("Bearer ", "");
    if (!token) return next(new Error("Authentication required"));
    const user = await verifyToken(token);
    if (!user || user.role !== "ADMIN") return next(new Error("Admin access required"));
    (socket as AuthSocket & typeof socket).user = user;
    next();
  });

  adminNs.on("connection", async (socket) => {
    const user = (socket as AuthSocket & typeof socket).user!;
    logger.info({ userId: user.userId }, "Admin socket connected");
    await socket.join("admin_global");

    // Admins can join any conversation room for real-time message delivery
    socket.on("join_conversation", async (conversationId: string) => {
      const conv = await db
        .select({ id: chatConversationsTable.id })
        .from(chatConversationsTable)
        .where(eq(chatConversationsTable.id, conversationId))
        .limit(1);
      if (conv[0]) {
        await socket.join(`conversation:${conversationId}`);
      }
    });

    socket.on("disconnect", () => logger.info("Admin disconnected"));
  });

  logger.info("Socket.IO initialized with /customer, /store, /admin namespaces");
  return io;
}

let _io: SocketIOServer | null = null;
export function setIO(io: SocketIOServer) { _io = io; }
export function getIO(): SocketIOServer | null { return _io; }

// ── Emit helpers ─────────────────────────────────────────────

export function emitToCustomerOrder(orderId: string, event: string, data: unknown) {
  _io?.of("/customer").to(`order:${orderId}`).emit(event, data);
}

export function emitToCustomerUser(userId: string, event: string, data: unknown) {
  _io?.of("/customer").to(`user:${userId}`).emit(event, data);
}

export function emitToAllCustomers(event: string, data: unknown) {
  _io?.of("/customer").emit(event, data);
}

export function emitToStore(storeId: string, event: string, data: unknown) {
  _io?.of("/store").to(`store:${storeId}`).emit(event, data);
}

export function emitToAdmin(event: string, data: unknown) {
  _io?.of("/admin").to("admin_global").emit(event, data);
}

export function emitToConversation(conversationId: string, event: string, data: unknown) {
  // Emit to all participants across namespaces
  const room = `conversation:${conversationId}`;
  _io?.of("/customer").to(room).emit(event, data);
  _io?.of("/store").to(room).emit(event, data);
  _io?.of("/admin").to(room).emit(event, data);
}

// Broadcast store availability changes to all customers
export function emitStoreAvailabilityChanged(storeId: string, isActive: boolean, isCurrentlyOpen: boolean) {
  emitToAllCustomers("store_availability_changed", { storeId, isActive, isCurrentlyOpen });
  emitToAdmin("store_availability_changed", { storeId, isActive });
}

export function emitStoreVisibilityChanged(storeId: string, visible: boolean) {
  emitToAllCustomers("store_visibility_changed", { storeId, visible });
  emitToAdmin("store_visibility_changed", { storeId, visible });
}

export function emitStoreStatusChanged(storeId: string, status: string, reason?: string) {
  emitToStore(storeId, "store_status_changed", { storeId, status, reason });
  emitToAllCustomers("store_status_changed", { storeId, status });
  emitToAdmin("store_status_changed", { storeId, status, reason });
}

export function emitProductApproved(productId: string, storeId: string, productData?: unknown) {
  emitToStore(storeId, "product_approved", { productId });
  emitToAllCustomers("product_approved", { productId, storeId, productData });
}

export function emitProductRejected(productId: string, storeId: string, reason: string) {
  emitToStore(storeId, "product_rejected", { productId, reason });
}

export function emitProductStockUpdated(productId: string, storeId: string, newQty: number) {
  emitToAllCustomers("product_stock_updated", { productId, storeId, newQty });
  emitToAdmin("product_stock_updated", { productId, storeId, newQty });
}

export function emitNewStoreApplication(storeId: string, storeName: string, ownerName: string) {
  emitToAdmin("new_store_application", { storeId, storeName, ownerName, submittedAt: new Date().toISOString() });
}

export function emitNewProductPending(productId: string, storeId: string, storeName: string, productName: string) {
  emitToAdmin("new_product_pending", { productId, storeId, storeName, productName });
}

export function emitNewOrder(orderId: string, storeId: string, customerId: string, total: number, itemCount: number) {
  emitToStore(storeId, "new_order", { orderId, customerId, total, itemCount });
  emitToAdmin("new_order", { orderId, storeId, customerId, total, itemCount });
}

export function emitUserBanned(userId: string) {
  emitToCustomerUser(userId, "user_banned", { userId });
  emitToAdmin("user_banned", { userId });
}
