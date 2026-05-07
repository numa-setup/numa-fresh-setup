import { Router } from "express";
import { db } from "@workspace/db";
import { notificationsTable } from "@workspace/db/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { authenticate, AuthRequest } from "../middlewares/authenticate.js";
import { getIO } from "../socket/index.js";

const router = Router();

router.use(authenticate);

// GET /api/notifications — user's notifications
router.get("/", async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const limit = Math.min(parseInt(String(req.query.limit ?? "50")), 100);

    const rows = await db
      .select()
      .from(notificationsTable)
      .where(eq(notificationsTable.userId, userId))
      .orderBy(desc(notificationsTable.createdAt))
      .limit(limit);

    const unreadCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(notificationsTable)
      .where(and(eq(notificationsTable.userId, userId), eq(notificationsTable.isRead, false)));

    res.json({ notifications: rows, unreadCount: Number(unreadCount[0]?.count ?? 0) });
  } catch (err) {
    req.log.error({ err }, "Get notifications error");
    res.status(500).json({ error: "ServerError" });
  }
});

// PATCH /api/notifications/:id/read — mark one as read
router.patch("/:id/read", async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    await db
      .update(notificationsTable)
      .set({ isRead: true })
      .where(and(eq(notificationsTable.id, req.params.id), eq(notificationsTable.userId, userId)));
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Mark read error");
    res.status(500).json({ error: "ServerError" });
  }
});

// PATCH /api/notifications/mark-all-read — mark all as read
router.patch("/mark-all-read", async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    await db
      .update(notificationsTable)
      .set({ isRead: true })
      .where(and(eq(notificationsTable.userId, userId), eq(notificationsTable.isRead, false)));
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Mark all read error");
    res.status(500).json({ error: "ServerError" });
  }
});

export default router;

// ── Helper to create a notification and push via socket ──────────────────────
export async function createNotification(
  userId: string,
  type: string,
  title: string,
  body: string,
  data?: unknown,
  orderId?: string
) {
  try {
    const [notif] = await db
      .insert(notificationsTable)
      .values({ userId, type, title, body, dataJson: data ?? null, orderId: orderId ?? null })
      .returning();

    // Push to all namespaces via personal room user:{userId}
    const io = getIO();
    if (io && notif) {
      const payload = { id: notif.id, type, title, body, dataJson: data ?? null, orderId: orderId ?? null, isRead: false, createdAt: notif.createdAt };
      io.of("/customer").to(`user:${userId}`).emit("new_notification", payload);
      io.of("/store").to(`user:${userId}`).emit("new_notification", payload);
      io.of("/admin").to(`user:${userId}`).emit("new_notification", payload);
    }

    return notif;
  } catch (e) {
    console.error("createNotification failed", e);
    return null;
  }
}
