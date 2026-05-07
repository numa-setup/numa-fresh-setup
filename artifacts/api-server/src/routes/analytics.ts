import { Router } from "express";
import { db } from "@workspace/db";
import { ordersTable, storesTable, productsTable, usersTable, orderItemsTable } from "@workspace/db/schema";
import { eq, and, desc, count, sql, gte } from "drizzle-orm";
import { authenticate, authorize, AuthRequest } from "../middlewares/authenticate.js";

const router = Router();

// GET /api/platform/stats (public)
router.get("/platform/stats", async (req, res) => {
  try {
    const [storesResult, productsResult, ordersResult, citiesResult] = await Promise.all([
      db.select({ count: count() }).from(storesTable).where(and(eq(storesTable.isActive, true), eq(storesTable.isApproved, true))),
      db.select({ count: count() }).from(productsTable).where(eq(productsTable.isActive, true)),
      db.select({ count: count() }).from(ordersTable).where(eq(ordersTable.status, "COMPLETED")),
      db.selectDistinct({ city: storesTable.city }).from(storesTable).where(and(eq(storesTable.isActive, true), eq(storesTable.isApproved, true))),
    ]);

    const halalCertResult = await db.select({ count: count() }).from(storesTable)
      .where(and(eq(storesTable.isActive, true), eq(storesTable.isHalalCertified, true)));

    res.json({
      totalStores: storesResult[0]?.count ?? 0,
      totalProducts: productsResult[0]?.count ?? 0,
      citiesServed: citiesResult.length,
      ordersCompleted: ordersResult[0]?.count ?? 0,
      halalCertifiedStores: halalCertResult[0]?.count ?? 0,
    });
  } catch (err) {
    req.log.error({ err }, "Platform stats error");
    res.status(500).json({ error: "ServerError", message: "Failed to fetch platform stats" });
  }
});

// GET /api/store-portal/analytics
router.get("/store-portal/analytics", authenticate, authorize("STORE_OWNER", "ADMIN"), async (req: AuthRequest, res) => {
  try {
    const { period = "30d" } = req.query as Record<string, string>;
    const days = period === "7d" ? 7 : period === "90d" ? 90 : 30;
    const since = new Date();
    since.setDate(since.getDate() - days);

    const [store] = await db.select().from(storesTable).where(eq(storesTable.ownerId, req.user!.userId)).limit(1);
    if (!store) {
      res.status(404).json({ error: "NotFound", message: "Store not found" });
      return;
    }

    const orders = await db.select().from(ordersTable)
      .where(and(eq(ordersTable.storeId, store.id), gte(ordersTable.createdAt, since)));

    const completedOrders = orders.filter(o => o.status === "COMPLETED");
    const totalRevenue = completedOrders.reduce((sum, o) => sum + (o.finalTotal ?? o.estimatedTotal), 0);
    const totalCommission = totalRevenue * (store.commissionRate / 100);
    const avgOrderValue = completedOrders.length > 0 ? totalRevenue / completedOrders.length : 0;

    // Daily revenue
    const dailyMap = new Map<string, { revenue: number; orders: number }>();
    completedOrders.forEach(o => {
      const date = o.createdAt.toISOString().split("T")[0];
      const prev = dailyMap.get(date) || { revenue: 0, orders: 0 };
      dailyMap.set(date, {
        revenue: prev.revenue + (o.finalTotal ?? o.estimatedTotal),
        orders: prev.orders + 1,
      });
    });

    const dailyRevenue = Array.from(dailyMap.entries())
      .map(([date, data]) => ({ date, ...data }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const orderStatusBreakdown = orders.reduce((acc, o) => {
      acc[o.status] = (acc[o.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    res.json({
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      totalOrders: orders.length,
      avgOrderValue: Math.round(avgOrderValue * 100) / 100,
      totalCommission: Math.round(totalCommission * 100) / 100,
      avgPrepTime: store.avgPrepTimeMinutes,
      topProducts: [],
      dailyRevenue,
      orderStatusBreakdown,
    });
  } catch (err) {
    req.log.error({ err }, "Store analytics error");
    res.status(500).json({ error: "ServerError", message: "Failed to fetch analytics" });
  }
});

// GET /api/store-portal/dashboard
router.get("/store-portal/dashboard", authenticate, authorize("STORE_OWNER", "STORE_STAFF", "ADMIN"), async (req: AuthRequest, res) => {
  try {
    const [store] = await db.select().from(storesTable).where(eq(storesTable.ownerId, req.user!.userId)).limit(1);
    if (!store) {
      res.status(404).json({ error: "NotFound", message: "Store not found" });
      return;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [todayOrders, pendingOrders, activeProducts, recentOrders, lowStockProducts] = await Promise.all([
      db.select({ count: count() }).from(ordersTable).where(and(eq(ordersTable.storeId, store.id), gte(ordersTable.createdAt, today))),
      db.select({ count: count() }).from(ordersTable).where(and(eq(ordersTable.storeId, store.id), eq(ordersTable.status, "PENDING"))),
      db.select({ count: count() }).from(productsTable).where(and(eq(productsTable.storeId, store.id), eq(productsTable.isActive, true))),
      db.select().from(ordersTable).where(eq(ordersTable.storeId, store.id)).orderBy(desc(ordersTable.createdAt)).limit(10),
      db.select().from(productsTable).where(and(eq(productsTable.storeId, store.id), eq(productsTable.isActive, true))).limit(5),
    ]);

    const todayCompletedOrders = await db.select().from(ordersTable)
      .where(and(eq(ordersTable.storeId, store.id), eq(ordersTable.status, "COMPLETED"), gte(ordersTable.createdAt, today)));

    const todayRevenue = todayCompletedOrders.reduce((sum, o) => sum + (o.finalTotal ?? o.estimatedTotal), 0);

    const recentOrdersWithDetails = await Promise.all(
      recentOrders.map(async (order) => ({
        ...order,
        items: await db.select().from(orderItemsTable).where(eq(orderItemsTable.orderId, order.id)),
        store,
      }))
    );

    res.json({
      todayOrders: todayOrders[0]?.count ?? 0,
      pendingOrders: pendingOrders[0]?.count ?? 0,
      todayRevenue: Math.round(todayRevenue * 100) / 100,
      activeProducts: activeProducts[0]?.count ?? 0,
      recentOrders: recentOrdersWithDetails,
      lowStockProducts,
    });
  } catch (err) {
    req.log.error({ err }, "Store dashboard error");
    res.status(500).json({ error: "ServerError", message: "Failed to fetch dashboard" });
  }
});

// GET /api/admin/dashboard
router.get("/admin/dashboard", authenticate, authorize("ADMIN"), async (req: AuthRequest, res) => {
  try {
    const [totalUsers, totalStores, totalOrders, revenueResult, pendingStoreApprovals, openTickets, recentOrders] = await Promise.all([
      db.select({ count: count() }).from(usersTable),
      db.select({ count: count() }).from(storesTable),
      db.select({ count: count() }).from(ordersTable),
      db.select({ total: sql<number>`COALESCE(SUM(CASE WHEN status = 'COMPLETED' THEN COALESCE(final_total, estimated_total) ELSE 0 END), 0)::float` }).from(ordersTable),
      db.select({ count: count() }).from(storesTable).where(eq(storesTable.isApproved, false)),
      Promise.resolve([{ count: 0 }]),
      db.select().from(ordersTable).orderBy(desc(ordersTable.createdAt)).limit(10),
    ]);

    const recentOrdersWithDetails = await Promise.all(
      recentOrders.map(async (order) => ({
        ...order,
        items: await db.select().from(orderItemsTable).where(eq(orderItemsTable.orderId, order.id)),
        store: await db.select().from(storesTable).where(eq(storesTable.id, order.storeId)).limit(1).then(r => r[0]),
      }))
    );

    res.json({
      totalUsers: totalUsers[0]?.count ?? 0,
      totalStores: totalStores[0]?.count ?? 0,
      totalOrders: totalOrders[0]?.count ?? 0,
      platformRevenue: revenueResult[0]?.total ?? 0,
      pendingStoreApprovals: pendingStoreApprovals[0]?.count ?? 0,
      openSupportTickets: openTickets[0]?.count ?? 0,
      recentOrders: recentOrdersWithDetails,
      revenueByDay: [],
    });
  } catch (err) {
    req.log.error({ err }, "Admin dashboard error");
    res.status(500).json({ error: "ServerError", message: "Failed to fetch admin dashboard" });
  }
});

// GET /api/admin/stores
router.get("/admin/stores", authenticate, authorize("ADMIN"), async (req: AuthRequest, res) => {
  try {
    const { page = "1", limit = "20" } = req.query as Record<string, string>;
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, parseInt(limit) || 20);
    const offset = (pageNum - 1) * limitNum;

    const [stores, totalResult] = await Promise.all([
      db.select().from(storesTable).orderBy(desc(storesTable.createdAt)).limit(limitNum).offset(offset),
      db.select({ count: count() }).from(storesTable),
    ]);

    const total = totalResult[0]?.count ?? 0;
    res.json({ stores, total, page: pageNum, totalPages: Math.ceil(total / limitNum) });
  } catch (err) {
    req.log.error({ err }, "Admin list stores error");
    res.status(500).json({ error: "ServerError", message: "Failed to fetch stores" });
  }
});

// PATCH /api/admin/stores/:storeId/approve
router.patch("/admin/stores/:storeId/approve", authenticate, authorize("ADMIN"), async (req: AuthRequest, res) => {
  try {
    const [store] = await db.update(storesTable)
      .set({ isApproved: true, isActive: true })
      .where(eq(storesTable.id, req.params.storeId))
      .returning();

    if (!store) {
      res.status(404).json({ error: "NotFound", message: "Store not found" });
      return;
    }

    res.json(store);
  } catch (err) {
    req.log.error({ err }, "Approve store error");
    res.status(500).json({ error: "ServerError", message: "Failed to approve store" });
  }
});

// GET /api/admin/users
router.get("/admin/users", authenticate, authorize("ADMIN"), async (req: AuthRequest, res) => {
  try {
    const { page = "1", limit = "20" } = req.query as Record<string, string>;
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, parseInt(limit) || 20);
    const offset = (pageNum - 1) * limitNum;

    const [users, totalResult] = await Promise.all([
      db.select().from(usersTable).orderBy(desc(usersTable.createdAt)).limit(limitNum).offset(offset),
      db.select({ count: count() }).from(usersTable),
    ]);

    const safeUsers = users.map(({ passwordHash: _, ...u }) => u);
    const total = totalResult[0]?.count ?? 0;
    res.json({ users: safeUsers, total, page: pageNum, totalPages: Math.ceil(total / limitNum) });
  } catch (err) {
    req.log.error({ err }, "Admin list users error");
    res.status(500).json({ error: "ServerError", message: "Failed to fetch users" });
  }
});

// GET /api/admin/orders
router.get("/admin/orders", authenticate, authorize("ADMIN"), async (req: AuthRequest, res) => {
  try {
    const { page = "1", limit = "50" } = req.query as Record<string, string>;
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, parseInt(limit) || 50);
    const offset = (pageNum - 1) * limitNum;

    const [orders, totalResult] = await Promise.all([
      db.select().from(ordersTable).orderBy(desc(ordersTable.createdAt)).limit(limitNum).offset(offset),
      db.select({ count: count() }).from(ordersTable),
    ]);

    const total = totalResult[0]?.count ?? 0;
    const ordersWithDetails = orders.map(o => ({ ...o, items: [], store: null }));
    res.json({ orders: ordersWithDetails, total, page: pageNum, totalPages: Math.ceil(total / limitNum) });
  } catch (err) {
    req.log.error({ err }, "Admin list orders error");
    res.status(500).json({ error: "ServerError", message: "Failed to fetch orders" });
  }
});

export default router;
