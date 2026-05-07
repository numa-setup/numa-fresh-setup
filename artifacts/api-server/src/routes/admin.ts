import { Router } from "express";
import { db } from "@workspace/db";
import {
  storesTable, productsTable, ordersTable, orderItemsTable,
  usersTable, orderStatusHistoryTable, reviewsTable
} from "@workspace/db/schema";
import { eq, and, desc, count, sql, gte, lt, or, ilike, inArray, not } from "drizzle-orm";
import { authenticate, authorize, AuthRequest } from "../middlewares/authenticate.js";
import { hashPassword } from "../lib/auth.js";
import { createNotification } from "./notifications.js";

const router = Router();

router.use(authenticate);
router.use(authorize("ADMIN"));

// ── DASHBOARD ──────────────────────────────────────────────
router.get("/dashboard", async (req: AuthRequest, res) => {
  try {
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(); todayEnd.setHours(23, 59, 59, 999);
    const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);
    const monthAgo = new Date(); monthAgo.setDate(monthAgo.getDate() - 30);

    const [
      totalUsersResult,
      totalStoresResult,
      activeStoresResult,
      pendingStoresResult,
      totalOrdersResult,
      todayOrdersResult,
      allCompletedOrders,
      recentOrders,
    ] = await Promise.all([
      db.select({ count: count() }).from(usersTable),
      db.select({ count: count() }).from(storesTable),
      db.select({ count: count() }).from(storesTable).where(and(eq(storesTable.isActive, true), eq(storesTable.isApproved, true))),
      db.select({ count: count() }).from(storesTable).where(eq(storesTable.isApproved, false)),
      db.select({ count: count() }).from(ordersTable),
      db.select({ count: count() }).from(ordersTable).where(and(gte(ordersTable.createdAt, todayStart), lt(ordersTable.createdAt, todayEnd))),
      db.select({ finalTotal: ordersTable.finalTotal, estimatedTotal: ordersTable.estimatedTotal, createdAt: ordersTable.createdAt })
        .from(ordersTable).where(eq(ordersTable.status, "COMPLETED")),
      db.select({
        id: ordersTable.id, orderNumber: ordersTable.orderNumber,
        status: ordersTable.status, orderType: ordersTable.orderType,
        estimatedTotal: ordersTable.estimatedTotal, finalTotal: ordersTable.finalTotal,
        createdAt: ordersTable.createdAt,
        customerFirst: usersTable.firstName, customerLast: usersTable.lastName,
        storeName: storesTable.name,
      })
        .from(ordersTable)
        .leftJoin(usersTable, eq(ordersTable.customerId, usersTable.id))
        .leftJoin(storesTable, eq(ordersTable.storeId, storesTable.id))
        .orderBy(desc(ordersTable.createdAt))
        .limit(10),
    ]);

    const totalGMV = allCompletedOrders.reduce((s, o) => s + Number(o.finalTotal ?? o.estimatedTotal ?? 0), 0);
    const todayRevenue = allCompletedOrders
      .filter(o => o.createdAt >= todayStart)
      .reduce((s, o) => s + Number(o.finalTotal ?? o.estimatedTotal ?? 0), 0);
    const platformRevenue = totalGMV * 0.07; // 7% commission

    // Daily GMV for last 30 days
    const dailyMap = new Map<string, { gmv: number; orders: number }>();
    for (let i = 29; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const key = d.toISOString().split("T")[0];
      dailyMap.set(key, { gmv: 0, orders: 0 });
    }
    allCompletedOrders.forEach(o => {
      const key = o.createdAt.toISOString().split("T")[0];
      const prev = dailyMap.get(key);
      if (prev) dailyMap.set(key, { gmv: prev.gmv + Number(o.finalTotal ?? o.estimatedTotal ?? 0), orders: prev.orders + 1 });
    });
    const revenueByDay = Array.from(dailyMap.entries()).map(([date, data]) => ({ date, ...data }));

    // Activity feed (use recent orders as events)
    const activityFeed = recentOrders.slice(0, 8).map(o => ({
      type: o.status === "PENDING" ? "new_order" : o.status === "REFUNDED" ? "refund" : "order_update",
      message: o.status === "PENDING"
        ? `New order ${o.orderNumber} — $${(o.estimatedTotal || 0).toFixed(2)}`
        : o.status === "REFUNDED"
        ? `Refund issued — order ${o.orderNumber}`
        : `Order ${o.orderNumber} → ${o.status?.replace(/_/g, " ")}`,
      store: o.storeName,
      time: o.createdAt,
    }));

    res.json({
      kpis: {
        totalGMV: Math.round(totalGMV * 100) / 100,
        totalOrders: totalOrdersResult[0]?.count ?? 0,
        activeStores: activeStoresResult[0]?.count ?? 0,
        platformRevenue: Math.round(platformRevenue * 100) / 100,
        pendingApprovals: pendingStoresResult[0]?.count ?? 0,
        totalUsers: totalUsersResult[0]?.count ?? 0,
        todayOrders: todayOrdersResult[0]?.count ?? 0,
        todayRevenue: Math.round(todayRevenue * 100) / 100,
      },
      revenueByDay,
      recentOrders,
      activityFeed,
    });
  } catch (err) {
    req.log.error({ err }, "Admin dashboard error");
    res.status(500).json({ error: "ServerError" });
  }
});

// ── STORES ──────────────────────────────────────────────────
router.get("/stores", async (req: AuthRequest, res) => {
  try {
    const { status = "all", search = "", page = "1", limit = "10", province = "" } = req.query as Record<string, string>;
    const pageNum = Math.max(1, Number(page));
    const limitNum = Math.min(100, Math.max(1, Number(limit)));
    const offset = (pageNum - 1) * limitNum;

    const conditions = [];
    // Always exclude soft-deleted stores from any tab
    conditions.push(not(eq(storesTable.storeStatus, "deleted")));
    if (status === "pending") conditions.push(eq(storesTable.storeStatus, "pending"));
    else if (status === "approved") conditions.push(eq(storesTable.storeStatus, "approved"));
    else if (status === "declined") conditions.push(eq(storesTable.storeStatus, "declined"));
    else if (status === "suspended") conditions.push(eq(storesTable.storeStatus, "suspended"));
    // Legacy aliases
    else if (status === "active") conditions.push(and(eq(storesTable.isApproved, true), eq(storesTable.isActive, true)));
    else if (status === "inactive") conditions.push(and(eq(storesTable.isApproved, true), eq(storesTable.isActive, false)));
    if (search) conditions.push(or(
      ilike(storesTable.name, `%${search}%`),
      ilike(storesTable.city, `%${search}%`),
      ilike(storesTable.province, `%${search}%`),
    ));
    if (province) conditions.push(ilike(storesTable.province, `%${province}%`));

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [stores, totalResult] = await Promise.all([
      db.select({
        id: storesTable.id, slug: storesTable.slug, name: storesTable.name,
        city: storesTable.city, province: storesTable.province,
        isActive: storesTable.isActive, isApproved: storesTable.isApproved,
        storeStatus: storesTable.storeStatus, showOnWebsite: storesTable.showOnWebsite,
        isActiveManual: storesTable.isActiveManual, isCurrentlyOpen: storesTable.isCurrentlyOpen,
        onboardingCompleted: storesTable.onboardingCompleted,
        isHalalCertified: storesTable.isHalalCertified,
        halalCertNumber: storesTable.halalCertNumber,
        commissionRate: storesTable.commissionRate,
        rating: storesTable.rating, totalRatings: storesTable.totalRatings,
        email: storesTable.email, phone: storesTable.phone,
        createdAt: storesTable.createdAt, updatedAt: storesTable.updatedAt,
        ownerId: storesTable.ownerId,
        ownerFirst: usersTable.firstName, ownerLast: usersTable.lastName, ownerEmail: usersTable.email,
      })
        .from(storesTable)
        .leftJoin(usersTable, eq(storesTable.ownerId, usersTable.id))
        .where(where)
        .orderBy(desc(storesTable.createdAt))
        .limit(limitNum).offset(offset),
      db.select({ count: count() }).from(storesTable).where(where),
    ]);

    // For each store, get order count + revenue
    const storeIds = stores.map(s => s.id);
    const storeOrderStats = storeIds.length > 0
      ? await db.select({
          storeId: ordersTable.storeId,
          orderCount: count(),
          revenue: sql<number>`SUM(COALESCE(${ordersTable.finalTotal}, ${ordersTable.estimatedTotal}, 0))`,
        }).from(ordersTable).where(and(inArray(ordersTable.storeId, storeIds), eq(ordersTable.status, "COMPLETED")))
          .groupBy(ordersTable.storeId)
      : [];

    const statsMap = Object.fromEntries(storeOrderStats.map(s => [s.storeId, s]));

    const totalStores = totalResult[0]?.count ?? 0;
    res.json({
      stores: stores.map(s => ({
        ...s,
        orderCount: statsMap[s.id]?.orderCount ?? 0,
        revenue: Math.round(Number(statsMap[s.id]?.revenue ?? 0) * 100) / 100,
      })),
      total: totalStores,
      totalStores,
      page: pageNum,
      totalPages: Math.ceil(totalStores / limitNum),
    });
  } catch (err) {
    req.log.error({ err }, "Admin stores list error");
    res.status(500).json({ error: "ServerError" });
  }
});

router.get("/stores/:id", async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const [store] = await db.select().from(storesTable).where(eq(storesTable.id, id)).limit(1);
    if (!store) { res.status(404).json({ error: "NotFound" }); return; }
    const [owner] = await db.select({ id: usersTable.id, firstName: usersTable.firstName, lastName: usersTable.lastName, email: usersTable.email, phone: usersTable.phone })
      .from(usersTable).where(eq(usersTable.id, store.ownerId)).limit(1);
    const orders = await db.select({ status: ordersTable.status, finalTotal: ordersTable.finalTotal, estimatedTotal: ordersTable.estimatedTotal })
      .from(ordersTable).where(eq(ordersTable.storeId, id));
    const revenue = orders.filter(o => o.status === "COMPLETED").reduce((s, o) => s + Number(o.finalTotal ?? o.estimatedTotal ?? 0), 0);
    res.json({ ...store, owner, orderCount: orders.length, revenue: Math.round(revenue * 100) / 100 });
  } catch (err) {
    req.log.error({ err }, "Admin store detail error");
    res.status(500).json({ error: "ServerError" });
  }
});

// General store info update — all editable fields
router.patch("/stores/:id", async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const b = req.body as Record<string, any>;
    const allowed = [
      "name", "branchName", "tagline", "description", "phone", "email",
      "logo", "banner", "cardImage",
      "address", "city", "province", "postalCode", "lat", "lng", "googleMapsLink",
      "openingHoursJson",
      "servicesOffered", "amenityTags", "minOrderAmount", "convenienceFee", "avgPrepTimeMinutes",
      "slotDurationMinutes", "maxOrdersPerSlot",
      "pickupAvailable", "curbsideAvailable", "deliveryAvailable",
      "isHalalCertified", "halalCertNumber", "halalCertBody", "halalCertExpiry",
      "premiumFreshEnabled", "premiumFreshBadgeTitle", "premiumFreshHeading", "premiumFreshDesc",
      "premiumFreshCutTags", "premiumFreshBullet1", "premiumFreshBullet2",
      "premiumFreshBullet3", "premiumFreshImages",
      "storeCategories",
    ];
    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    for (const key of allowed) {
      if (b[key] !== undefined) updateData[key] = b[key];
    }
    // coerce numeric strings
    if (updateData.minOrderAmount !== undefined) updateData.minOrderAmount = Number(updateData.minOrderAmount) || 0;
    if (updateData.convenienceFee !== undefined) updateData.convenienceFee = Number(updateData.convenienceFee) || 0;
    if (updateData.avgPrepTimeMinutes !== undefined) updateData.avgPrepTimeMinutes = Number(updateData.avgPrepTimeMinutes) || 15;
    if (updateData.slotDurationMinutes !== undefined) updateData.slotDurationMinutes = Number(updateData.slotDurationMinutes) || 30;
    if (updateData.maxOrdersPerSlot !== undefined) updateData.maxOrdersPerSlot = Number(updateData.maxOrdersPerSlot) || 5;
    if (updateData.halalCertExpiry) updateData.halalCertExpiry = new Date(updateData.halalCertExpiry as string);

    const [store] = await db.update(storesTable)
      .set(updateData)
      .where(eq(storesTable.id, id))
      .returning();
    if (!store) { res.status(404).json({ error: "NotFound" }); return; }
    res.json({ success: true, store });
  } catch (err) {
    req.log.error({ err }, "Admin store update error");
    res.status(500).json({ error: "ServerError" });
  }
});

router.patch("/stores/:id/opening-hours", async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { openingHoursJson } = req.body as { openingHoursJson: Record<string, unknown> };
    const [store] = await db.update(storesTable)
      .set({ openingHoursJson, updatedAt: new Date() })
      .where(eq(storesTable.id, id))
      .returning();
    if (!store) { res.status(404).json({ error: "NotFound" }); return; }
    res.json({ success: true, store });
  } catch (err) {
    req.log.error({ err }, "Admin opening hours update error");
    res.status(500).json({ error: "ServerError" });
  }
});

router.patch("/stores/:id/approve", async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const [store] = await db.update(storesTable)
      .set({ isApproved: true, isActive: true, storeStatus: "approved", showOnWebsite: true, updatedAt: new Date() })
      .where(eq(storesTable.id, id)).returning();
    if (!store) { res.status(404).json({ error: "NotFound" }); return; }
    const { emitStoreStatusChanged } = await import("../socket/index.js");
    emitStoreStatusChanged(id, "approved");
    if (store.ownerId) {
      createNotification(store.ownerId, "STORE_APPROVED", "Store Approved!", `Congratulations! Your store "${store.name}" has been approved and is now live.`, { storeId: id }).catch(() => {});
    }
    res.json({ success: true, store });
  } catch (err) {
    req.log.error({ err }, "Admin approve store error");
    res.status(500).json({ error: "ServerError" });
  }
});

router.patch("/stores/:id/decline", async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body as { reason: string };
    if (!reason?.trim()) { res.status(400).json({ error: "Reason required" }); return; }
    const [store] = await db.update(storesTable)
      .set({ isApproved: false, isActive: false, storeStatus: "declined", rejectionReason: reason, showOnWebsite: false, updatedAt: new Date() })
      .where(eq(storesTable.id, id)).returning();
    if (!store) { res.status(404).json({ error: "NotFound" }); return; }
    const { emitStoreStatusChanged } = await import("../socket/index.js");
    emitStoreStatusChanged(id, "declined", reason);
    if (store.ownerId) {
      createNotification(store.ownerId, "STORE_REJECTED", "Store Application Update", `Your store "${store.name}" was not approved. Reason: ${reason}`, { storeId: id }).catch(() => {});
    }
    res.json({ success: true, store });
  } catch (err) {
    req.log.error({ err }, "Admin decline store error");
    res.status(500).json({ error: "ServerError" });
  }
});

// Keep old reject as alias
router.patch("/stores/:id/reject", async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body as { reason: string };
    const [store] = await db.update(storesTable)
      .set({ isApproved: false, isActive: false, storeStatus: "declined", rejectionReason: reason, updatedAt: new Date() })
      .where(eq(storesTable.id, id)).returning();
    if (!store) { res.status(404).json({ error: "NotFound" }); return; }
    const { emitStoreStatusChanged } = await import("../socket/index.js");
    emitStoreStatusChanged(id, "declined", reason);
    res.json({ success: true, store, reason });
  } catch (err) {
    req.log.error({ err }, "Admin reject store error");
    res.status(500).json({ error: "ServerError" });
  }
});

router.patch("/stores/:id/suspend", async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body as { reason?: string };
    const [store] = await db.update(storesTable)
      .set({ isActive: false, storeStatus: "suspended", isActiveManual: false, showOnWebsite: false, rejectionReason: reason ?? null, updatedAt: new Date() })
      .where(eq(storesTable.id, id)).returning();
    if (!store) { res.status(404).json({ error: "NotFound" }); return; }
    const { emitStoreStatusChanged, emitStoreVisibilityChanged } = await import("../socket/index.js");
    emitStoreStatusChanged(id, "suspended", reason);
    emitStoreVisibilityChanged(id, false);
    res.json({ success: true, store });
  } catch (err) {
    req.log.error({ err }, "Admin suspend store error");
    res.status(500).json({ error: "ServerError" });
  }
});

router.patch("/stores/:id/unsuspend", async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const [store] = await db.update(storesTable)
      .set({ isActive: true, storeStatus: "approved", isActiveManual: true, showOnWebsite: true, rejectionReason: null, updatedAt: new Date() })
      .where(eq(storesTable.id, id)).returning();
    if (!store) { res.status(404).json({ error: "NotFound" }); return; }
    const { emitStoreStatusChanged } = await import("../socket/index.js");
    emitStoreStatusChanged(id, "approved");
    res.json({ success: true, store });
  } catch (err) {
    req.log.error({ err }, "Admin unsuspend store error");
    res.status(500).json({ error: "ServerError" });
  }
});

router.patch("/stores/:id/toggle-active", async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const [current] = await db.select({ isActiveManual: storesTable.isActiveManual, isCurrentlyOpen: storesTable.isCurrentlyOpen })
      .from(storesTable).where(eq(storesTable.id, id)).limit(1);
    if (!current) { res.status(404).json({ error: "NotFound" }); return; }
    const newValue = req.body.isActive ?? !current.isActiveManual;
    const [store] = await db.update(storesTable).set({ isActiveManual: newValue, updatedAt: new Date() }).where(eq(storesTable.id, id)).returning();
    const { emitStoreAvailabilityChanged } = await import("../socket/index.js");
    emitStoreAvailabilityChanged(id, newValue, store.isCurrentlyOpen);
    res.json({ success: true, store });
  } catch (err) {
    req.log.error({ err }, "Admin toggle-active store error");
    res.status(500).json({ error: "ServerError" });
  }
});

router.patch("/stores/:id/toggle-visibility", async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const [current] = await db.select({ showOnWebsite: storesTable.showOnWebsite }).from(storesTable).where(eq(storesTable.id, id)).limit(1);
    if (!current) { res.status(404).json({ error: "NotFound" }); return; }
    const newValue = req.body.visible ?? !current.showOnWebsite;
    const [store] = await db.update(storesTable).set({ showOnWebsite: newValue, updatedAt: new Date() }).where(eq(storesTable.id, id)).returning();
    const { emitStoreVisibilityChanged } = await import("../socket/index.js");
    emitStoreVisibilityChanged(id, newValue);
    res.json({ success: true, store });
  } catch (err) {
    req.log.error({ err }, "Admin toggle-visibility store error");
    res.status(500).json({ error: "ServerError" });
  }
});

router.patch("/stores/:id/commission", async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { commissionRate } = req.body as { commissionRate: number };
    const [store] = await db.update(storesTable).set({ commissionRate, updatedAt: new Date() })
      .where(eq(storesTable.id, id)).returning();
    if (!store) { res.status(404).json({ error: "NotFound" }); return; }
    res.json({ success: true, store });
  } catch (err) {
    req.log.error({ err }, "Admin commission update error");
    res.status(500).json({ error: "ServerError" });
  }
});

// ── ORDERS ──────────────────────────────────────────────────
router.get("/orders", async (req: AuthRequest, res) => {
  try {
    const { status, storeId, search, page = "1", limit = "25" } = req.query as Record<string, string>;
    const pageNum = Math.max(1, Number(page));
    const limitNum = Math.min(100, Math.max(1, Number(limit)));
    const offset = (pageNum - 1) * limitNum;

    const conditions = [];
    if (status && status !== "_all") conditions.push(eq(ordersTable.status, status as any));
    if (storeId) conditions.push(eq(ordersTable.storeId, storeId));
    if (search) conditions.push(or(ilike(ordersTable.orderNumber, `%${search}%`)));
    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [orders, totalResult] = await Promise.all([
      db.select({
        id: ordersTable.id, orderNumber: ordersTable.orderNumber,
        status: ordersTable.status, orderType: ordersTable.orderType,
        subtotal: ordersTable.subtotal, estimatedTotal: ordersTable.estimatedTotal,
        finalTotal: ordersTable.finalTotal, createdAt: ordersTable.createdAt,
        paymentStatus: ordersTable.paymentStatus,
        customerId: ordersTable.customerId,
        customerFirst: usersTable.firstName, customerLast: usersTable.lastName,
        storeId: ordersTable.storeId, storeName: storesTable.name,
      })
        .from(ordersTable)
        .leftJoin(usersTable, eq(ordersTable.customerId, usersTable.id))
        .leftJoin(storesTable, eq(ordersTable.storeId, storesTable.id))
        .where(where)
        .orderBy(desc(ordersTable.createdAt))
        .limit(limitNum).offset(offset),
      db.select({ count: count() }).from(ordersTable).where(where),
    ]);

    res.json({ orders, total: totalResult[0]?.count ?? 0, page: pageNum, totalPages: Math.ceil((totalResult[0]?.count ?? 0) / limitNum) });
  } catch (err) {
    req.log.error({ err }, "Admin orders list error");
    res.status(500).json({ error: "ServerError" });
  }
});

router.get("/orders/:id", async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, id)).limit(1);
    if (!order) { res.status(404).json({ error: "NotFound" }); return; }
    const [customer, store, items, history] = await Promise.all([
      db.select().from(usersTable).where(eq(usersTable.id, order.customerId)).limit(1),
      db.select().from(storesTable).where(eq(storesTable.id, order.storeId)).limit(1),
      db.select().from(orderItemsTable).where(eq(orderItemsTable.orderId, id)),
      db.select().from(orderStatusHistoryTable).where(eq(orderStatusHistoryTable.orderId, id)).orderBy(desc(orderStatusHistoryTable.createdAt)),
    ]);
    res.json({ ...order, customer: customer[0], store: store[0], items, history });
  } catch (err) {
    req.log.error({ err }, "Admin order detail error");
    res.status(500).json({ error: "ServerError" });
  }
});

router.post("/orders/:id/refund", async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { amount, reason } = req.body as { amount: number; reason: string };
    const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, id)).limit(1);
    if (!order) { res.status(404).json({ error: "NotFound" }); return; }
    const [updated] = await db.update(ordersTable)
      .set({ status: "REFUNDED", refundAmount: amount, refundedAt: new Date(), cancelReason: reason, updatedAt: new Date() })
      .where(eq(ordersTable.id, id)).returning();
    await db.insert(orderStatusHistoryTable).values({ orderId: id, status: "REFUNDED", note: `Refund: $${amount} — ${reason}`, createdBy: req.user!.userId });
    res.json({ success: true, order: updated });
  } catch (err) {
    req.log.error({ err }, "Admin refund error");
    res.status(500).json({ error: "ServerError" });
  }
});

router.post("/orders/:id/force-complete", async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const [updated] = await db.update(ordersTable)
      .set({ status: "COMPLETED", completedAt: new Date(), updatedAt: new Date() })
      .where(eq(ordersTable.id, id)).returning();
    if (!updated) { res.status(404).json({ error: "NotFound" }); return; }
    await db.insert(orderStatusHistoryTable).values({ orderId: id, status: "COMPLETED", note: "Force completed by admin", createdBy: req.user!.userId });
    res.json({ success: true, order: updated });
  } catch (err) {
    req.log.error({ err }, "Admin force complete error");
    res.status(500).json({ error: "ServerError" });
  }
});

// ── USERS ──────────────────────────────────────────────────
router.get("/users", async (req: AuthRequest, res) => {
  try {
    const { role, search, page = "1", limit = "25" } = req.query as Record<string, string>;
    const pageNum = Math.max(1, Number(page));
    const limitNum = Math.min(100, Math.max(1, Number(limit)));
    const offset = (pageNum - 1) * limitNum;

    const conditions = [];
    if (role && role !== "_all") conditions.push(eq(usersTable.role, role as any));
    if (search) conditions.push(or(
      ilike(usersTable.firstName, `%${search}%`),
      ilike(usersTable.lastName, `%${search}%`),
      ilike(usersTable.email, `%${search}%`)
    ));
    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [users, totalResult] = await Promise.all([
      db.select({
        id: usersTable.id, email: usersTable.email, firstName: usersTable.firstName,
        lastName: usersTable.lastName, role: usersTable.role, isActive: usersTable.isActive,
        isVerified: usersTable.isVerified, loyaltyPoints: usersTable.loyaltyPoints,
        createdAt: usersTable.createdAt, updatedAt: usersTable.updatedAt, phone: usersTable.phone,
      })
        .from(usersTable).where(where)
        .orderBy(desc(usersTable.createdAt))
        .limit(limitNum).offset(offset),
      db.select({ count: count() }).from(usersTable).where(where),
    ]);

    // Get order counts for users
    const userIds = users.map(u => u.id);
    const orderCounts = userIds.length > 0
      ? await db.select({ customerId: ordersTable.customerId, orderCount: count() })
          .from(ordersTable).where(inArray(ordersTable.customerId, userIds))
          .groupBy(ordersTable.customerId)
      : [];
    const orderCountMap = Object.fromEntries(orderCounts.map(o => [o.customerId, o.orderCount]));

    res.json({
      users: users.map(u => ({ ...u, orderCount: orderCountMap[u.id] ?? 0 })),
      total: totalResult[0]?.count ?? 0,
      page: pageNum,
      totalPages: Math.ceil((totalResult[0]?.count ?? 0) / limitNum),
    });
  } catch (err) {
    req.log.error({ err }, "Admin users list error");
    res.status(500).json({ error: "ServerError" });
  }
});

router.patch("/users/:id/suspend", async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { suspend = true } = req.body as { suspend?: boolean };
    if (id === req.user!.userId) { res.status(400).json({ error: "CannotSuspendSelf" }); return; }
    const [user] = await db.update(usersTable).set({ isActive: !suspend, updatedAt: new Date() })
      .where(eq(usersTable.id, id)).returning();
    if (!user) { res.status(404).json({ error: "NotFound" }); return; }
    res.json({ success: true, user });
  } catch (err) {
    req.log.error({ err }, "Admin suspend user error");
    res.status(500).json({ error: "ServerError" });
  }
});

router.patch("/users/:id/role", async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body as { role: string };
    const validRoles = ["CUSTOMER", "STORE_OWNER", "STORE_STAFF", "ADMIN"];
    if (!validRoles.includes(role)) { res.status(400).json({ error: "InvalidRole" }); return; }
    const [user] = await db.update(usersTable).set({ role: role as any, updatedAt: new Date() })
      .where(eq(usersTable.id, id)).returning();
    if (!user) { res.status(404).json({ error: "NotFound" }); return; }
    res.json({ success: true, user });
  } catch (err) {
    req.log.error({ err }, "Admin change role error");
    res.status(500).json({ error: "ServerError" });
  }
});

// ── FINANCE ──────────────────────────────────────────────────
router.get("/finance", async (req: AuthRequest, res) => {
  try {
    const { period = "month" } = req.query as Record<string, string>;
    const days = period === "today" ? 1 : period === "week" ? 7 : period === "year" ? 365 : 30;
    const since = new Date(); since.setDate(since.getDate() - days);

    const allTime = await db.select({ finalTotal: ordersTable.finalTotal, estimatedTotal: ordersTable.estimatedTotal, storeId: ordersTable.storeId, createdAt: ordersTable.createdAt, convenienceFee: ordersTable.convenienceFee })
      .from(ordersTable).where(eq(ordersTable.status, "COMPLETED"));
    const periodOrders = allTime.filter(o => o.createdAt >= since);

    const calcGMV = (orders: typeof allTime) => orders.reduce((s, o) => s + Number(o.finalTotal ?? o.estimatedTotal ?? 0), 0);
    const calcFees = (orders: typeof allTime) => orders.reduce((s, o) => s + Number(o.convenienceFee ?? 0), 0);
    const calcCommission = (orders: typeof allTime, rate = 0.07) => calcGMV(orders) * rate;

    const totalGMV = calcGMV(allTime);
    const periodGMV = calcGMV(periodOrders);
    const periodCommission = calcCommission(periodOrders);
    const periodFees = calcFees(periodOrders);

    // Per-store breakdown
    const stores = await db.select({ id: storesTable.id, name: storesTable.name, commissionRate: storesTable.commissionRate }).from(storesTable);
    const storeMap = Object.fromEntries(stores.map(s => [s.id, s]));

    const storeRevenue: Record<string, { name: string; gross: number; commission: number; net: number; orders: number; rate: number }> = {};
    periodOrders.forEach(o => {
      const store = storeMap[o.storeId];
      if (!store) return;
      const gross = Number(o.finalTotal ?? o.estimatedTotal ?? 0);
      const rate = (store.commissionRate ?? 7) / 100;
      const commission = gross * rate;
      if (!storeRevenue[o.storeId]) storeRevenue[o.storeId] = { name: store.name, gross: 0, commission: 0, net: 0, orders: 0, rate: store.commissionRate };
      storeRevenue[o.storeId].gross += gross;
      storeRevenue[o.storeId].commission += commission;
      storeRevenue[o.storeId].net += gross - commission;
      storeRevenue[o.storeId].orders += 1;
    });

    const payouts = Object.entries(storeRevenue).map(([storeId, data]) => ({
      storeId, ...data,
      gross: Math.round(data.gross * 100) / 100,
      commission: Math.round(data.commission * 100) / 100,
      net: Math.round(data.net * 100) / 100,
      status: "pending",
    }));

    res.json({
      summary: {
        totalGMV: Math.round(totalGMV * 100) / 100,
        periodGMV: Math.round(periodGMV * 100) / 100,
        periodCommission: Math.round(periodCommission * 100) / 100,
        periodConvenienceFees: Math.round(periodFees * 100) / 100,
        periodRevenue: Math.round((periodCommission + periodFees) * 100) / 100,
        outstandingPayouts: Math.round(payouts.reduce((s, p) => s + p.net, 0) * 100) / 100,
      },
      payouts,
      period,
    });
  } catch (err) {
    req.log.error({ err }, "Admin finance error");
    res.status(500).json({ error: "ServerError" });
  }
});

// ── ANALYTICS ──────────────────────────────────────────────
router.get("/analytics", async (req: AuthRequest, res) => {
  try {
    const { period = "30d" } = req.query as Record<string, string>;
    const days = period === "7d" ? 7 : period === "90d" ? 90 : 30;
    const since = new Date(); since.setDate(since.getDate() - days);

    const [allOrders, stores, users] = await Promise.all([
      db.select({
        status: ordersTable.status, orderType: ordersTable.orderType,
        finalTotal: ordersTable.finalTotal, estimatedTotal: ordersTable.estimatedTotal,
        storeId: ordersTable.storeId, createdAt: ordersTable.createdAt,
        convenienceFee: ordersTable.convenienceFee,
      }).from(ordersTable).where(gte(ordersTable.createdAt, since)),
      db.select({ id: storesTable.id, name: storesTable.name, city: storesTable.city, commissionRate: storesTable.commissionRate })
        .from(storesTable).where(and(eq(storesTable.isActive, true), eq(storesTable.isApproved, true))),
      db.select({ createdAt: usersTable.createdAt }).from(usersTable).where(gte(usersTable.createdAt, since)),
    ]);

    const completed = allOrders.filter(o => o.status === "COMPLETED");

    // Order type distribution
    const typeMap: Record<string, number> = {};
    allOrders.forEach(o => { typeMap[o.orderType] = (typeMap[o.orderType] || 0) + 1; });
    const orderTypeDistribution = Object.entries(typeMap).map(([type, count]) => ({ type, count }));

    // Status breakdown
    const statusMap: Record<string, number> = {};
    allOrders.forEach(o => { statusMap[o.status] = (statusMap[o.status] || 0) + 1; });

    // Daily trends
    const dailyMap = new Map<string, { gmv: number; orders: number; newUsers: number }>();
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      dailyMap.set(d.toISOString().split("T")[0], { gmv: 0, orders: 0, newUsers: 0 });
    }
    completed.forEach(o => {
      const key = o.createdAt.toISOString().split("T")[0];
      const prev = dailyMap.get(key);
      if (prev) dailyMap.set(key, { ...prev, gmv: prev.gmv + Number(o.finalTotal ?? o.estimatedTotal ?? 0), orders: prev.orders + 1 });
    });
    users.forEach(u => {
      const key = u.createdAt.toISOString().split("T")[0];
      const prev = dailyMap.get(key);
      if (prev) dailyMap.set(key, { ...prev, newUsers: prev.newUsers + 1 });
    });
    const trends = Array.from(dailyMap.entries()).map(([date, data]) => ({ date, ...data }));

    // Store performance
    const storeMap = Object.fromEntries(stores.map(s => [s.id, s]));
    const storePerf: Record<string, { name: string; orders: number; gmv: number; city: string }> = {};
    completed.forEach(o => {
      const store = storeMap[o.storeId];
      if (!store) return;
      if (!storePerf[o.storeId]) storePerf[o.storeId] = { name: store.name, orders: 0, gmv: 0, city: store.city };
      storePerf[o.storeId].orders += 1;
      storePerf[o.storeId].gmv += Number(o.finalTotal ?? o.estimatedTotal ?? 0);
    });
    const storeLeague = Object.values(storePerf).sort((a, b) => b.gmv - a.gmv);

    res.json({
      summary: {
        totalOrders: allOrders.length, completedOrders: completed.length,
        totalGMV: Math.round(completed.reduce((s, o) => s + Number(o.finalTotal ?? o.estimatedTotal ?? 0), 0) * 100) / 100,
        newUsers: users.length,
        conversionRate: allOrders.length > 0 ? Math.round((completed.length / allOrders.length) * 1000) / 10 : 0,
      },
      trends, orderTypeDistribution, storeLeague, statusBreakdown: statusMap, period,
    });
  } catch (err) {
    req.log.error({ err }, "Admin analytics error");
    res.status(500).json({ error: "ServerError" });
  }
});

// ── SETTINGS ──────────────────────────────────────────────
const platformSettings = {
  defaultCommissionRate: 7.0,
  defaultConvenienceFee: 2.99,
  defaultCurbsideFee: 0.99,
  loyaltyPointsPerDollar: 10,
  pointsRedemptionRate: 0.01,
  minOrderForLoyalty: 10,
  payoutSchedule: "weekly",
  supportedStates: ["TX", "IL", "CA", "NY", "FL", "NJ", "VA", "MI", "OH", "GA"],
  maintenanceMode: false,
  platformName: "Numa Fresh",
  supportEmail: "support@numafreshmarketplace.com",
  maxOrdersPerSlot: 10,
  defaultSlotDurationMinutes: 30,
};

router.get("/settings", async (_req: AuthRequest, res) => {
  res.json(platformSettings);
});

router.put("/settings", async (req: AuthRequest, res) => {
  try {
    const updates = req.body as Partial<typeof platformSettings>;
    Object.assign(platformSettings, updates);
    res.json(platformSettings);
  } catch (err) {
    req.log.error({ err }, "Admin settings update error");
    res.status(500).json({ error: "ServerError" });
  }
});

// ── SUPPORT TICKETS (simulated) ─────────────────────────────
const supportTickets = [
  { id: "1", subject: "Order not received", status: "open", priority: "high", category: "order_issue", customerName: "Ahmed K.", email: "ahmed@example.com", orderId: null, message: "I placed an order 2 hours ago and haven't received any update. The store is not responding.", createdAt: new Date(Date.now() - 2 * 3600000).toISOString(), replies: [] },
  { id: "2", subject: "Wrong item received", status: "in_progress", priority: "medium", category: "order_issue", customerName: "Sara M.", email: "sara@example.com", orderId: null, message: "I ordered lamb but received chicken. Please help.", createdAt: new Date(Date.now() - 5 * 3600000).toISOString(), replies: [{ from: "admin", message: "We're looking into this. Will respond shortly.", time: new Date(Date.now() - 4 * 3600000).toISOString() }] },
  { id: "3", subject: "Payment charged twice", status: "open", priority: "urgent", category: "billing", customerName: "Omar J.", email: "omar@example.com", orderId: null, message: "I was charged twice for my last order. Please refund the duplicate charge.", createdAt: new Date(Date.now() - 1 * 3600000).toISOString(), replies: [] },
  { id: "4", subject: "How do I cancel my order?", status: "resolved", priority: "low", category: "general", customerName: "Fatima R.", email: "fatima@example.com", orderId: null, message: "I need to cancel my order. How do I do that?", createdAt: new Date(Date.now() - 24 * 3600000).toISOString(), replies: [{ from: "admin", message: "You can cancel orders from the My Orders page before the store confirms your order.", time: new Date(Date.now() - 23 * 3600000).toISOString() }] },
];

router.get("/support/tickets", async (_req: AuthRequest, res) => {
  const { status } = _req.query as Record<string, string>;
  const tickets = status && status !== "_all" ? supportTickets.filter(t => t.status === status) : supportTickets;
  res.json({ tickets, total: tickets.length });
});

router.post("/support/tickets/:id/reply", async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { message } = req.body as { message: string };
    const ticket = supportTickets.find(t => t.id === id);
    if (!ticket) { res.status(404).json({ error: "NotFound" }); return; }
    ticket.replies.push({ from: "admin", message, time: new Date().toISOString() });
    ticket.status = "in_progress";
    res.json({ success: true, ticket });
  } catch (err) {
    res.status(500).json({ error: "ServerError" });
  }
});

router.patch("/support/tickets/:id/resolve", async (req: AuthRequest, res) => {
  const { id } = req.params;
  const ticket = supportTickets.find(t => t.id === id);
  if (!ticket) { res.status(404).json({ error: "NotFound" }); return; }
  ticket.status = "resolved";
  res.json({ success: true, ticket });
});

// ── AUDIT LOG (from order status history) ──────────────────
router.get("/audit", async (req: AuthRequest, res) => {
  try {
    const { page = "1", limit = "50" } = req.query as Record<string, string>;
    const pageNum = Math.max(1, Number(page));
    const limitNum = Math.min(200, Math.max(1, Number(limit)));
    const offset = (pageNum - 1) * limitNum;

    const [logs, totalResult] = await Promise.all([
      db.select({
        id: orderStatusHistoryTable.id,
        orderId: orderStatusHistoryTable.orderId,
        status: orderStatusHistoryTable.status,
        note: orderStatusHistoryTable.note,
        createdBy: orderStatusHistoryTable.createdBy,
        actorFirstName: usersTable.firstName,
        actorLastName: usersTable.lastName,
        actorEmail: usersTable.email,
        createdAt: orderStatusHistoryTable.createdAt,
        orderNumber: ordersTable.orderNumber,
      })
        .from(orderStatusHistoryTable)
        .leftJoin(ordersTable, eq(orderStatusHistoryTable.orderId, ordersTable.id))
        .leftJoin(usersTable, eq(orderStatusHistoryTable.createdBy, usersTable.id))
        .orderBy(desc(orderStatusHistoryTable.createdAt))
        .limit(limitNum).offset(offset),
      db.select({ count: count() }).from(orderStatusHistoryTable),
    ]);

    res.json({ logs, total: totalResult[0]?.count ?? 0, page: pageNum, totalPages: Math.ceil((totalResult[0]?.count ?? 0) / limitNum) });
  } catch (err) {
    req.log.error({ err }, "Admin audit log error");
    res.status(500).json({ error: "ServerError" });
  }
});

// ── CONTENT (simulated) ────────────────────────────────────
const banners = [
  { id: "1", title: "Ramadan Special Offers", subtitle: "Up to 30% off on selected items", linkUrl: "/products", isActive: true, imageUrl: "https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=1200&q=80", order: 1 },
];

router.get("/content/banners", async (_req, res) => res.json(banners));
router.post("/content/banners", async (req: AuthRequest, res) => {
  const banner = { id: String(Date.now()), ...req.body, order: banners.length + 1 };
  banners.push(banner as any);
  res.json(banner);
});
router.patch("/content/banners/:id", async (req: AuthRequest, res) => {
  const banner = banners.find(b => b.id === req.params.id);
  if (!banner) { res.status(404).json({ error: "NotFound" }); return; }
  Object.assign(banner, req.body);
  res.json(banner);
});
router.delete("/content/banners/:id", async (req: AuthRequest, res) => {
  const idx = banners.findIndex(b => b.id === req.params.id);
  if (idx === -1) { res.status(404).json({ error: "NotFound" }); return; }
  banners.splice(idx, 1);
  res.json({ success: true });
});

// ── PRODUCT APPROVAL QUEUE ─────────────────────────────────
// GET /admin/products — list all products (all stores, all statuses)
router.get("/products", async (req: AuthRequest, res) => {
  try {
    const { page = "1", limit = "20", search = "", storeId = "" } = req.query as Record<string, string>;
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, parseInt(limit) || 20);
    const offset = (pageNum - 1) * limitNum;

    const conditions: any[] = [];
    if (storeId) conditions.push(eq(productsTable.storeId, storeId));
    if (search) {
      conditions.push(or(
        ilike(productsTable.name, `%${search}%`),
        ilike(productsTable.category, `%${search}%`),
      ));
    }

    const where = conditions.length ? and(...conditions) : undefined;
    const [products, totalResult] = await Promise.all([
      db.select().from(productsTable).where(where).orderBy(desc(productsTable.createdAt)).limit(limitNum).offset(offset),
      db.select({ count: count() }).from(productsTable).where(where),
    ]);

    const storeIds = [...new Set(products.map(p => p.storeId))];
    const stores = storeIds.length > 0 ? await db.select({ id: storesTable.id, name: storesTable.name }).from(storesTable).where(inArray(storesTable.id, storeIds)) : [];
    const storeMap = Object.fromEntries(stores.map(s => [s.id, s]));

    const total = totalResult[0]?.count ?? 0;
    res.json({
      products: products.map(p => ({ ...p, storeName: storeMap[p.storeId]?.name || '', store: storeMap[p.storeId] })),
      total, page: pageNum, totalPages: Math.ceil(total / limitNum),
    });
  } catch (err) {
    req.log.error({ err }, "Get all products error");
    res.status(500).json({ error: "ServerError" });
  }
});

// DELETE /admin/products/:id — admin delete any product
router.delete("/products/:id", async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const [product] = await db.select().from(productsTable).where(eq(productsTable.id, id)).limit(1);
    if (!product) { res.status(404).json({ error: "NotFound" }); return; }
    await db.delete(productsTable).where(eq(productsTable.id, id));
    res.json({ success: true, message: "Product deleted" });
  } catch (err) {
    req.log.error({ err }, "Delete product error");
    res.status(500).json({ error: "ServerError" });
  }
});

// PATCH /admin/products/:id/toggle-active — admin toggle product active status
router.patch("/products/:id/toggle-active", async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const [product] = await db.select().from(productsTable).where(eq(productsTable.id, id)).limit(1);
    if (!product) { res.status(404).json({ error: "NotFound" }); return; }
    await db.update(productsTable).set({ isActive: !product.isActive, updatedAt: new Date() }).where(eq(productsTable.id, id));
    res.json({ success: true, isActive: !product.isActive });
  } catch (err) {
    req.log.error({ err }, "Toggle product error");
    res.status(500).json({ error: "ServerError" });
  }
});

router.get("/products/pending", async (req: AuthRequest, res) => {
  try {
    const { page = "1", limit = "20", search = "", storeId = "" } = req.query as Record<string, string>;
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, parseInt(limit) || 20);
    const offset = (pageNum - 1) * limitNum;

    const baseConditions: any[] = [
      or(eq(productsTable.approvalStatus, "pending"), eq(productsTable.isApproved, false)),
    ];
    if (storeId) baseConditions.push(eq(productsTable.storeId, storeId));
    if (search) {
      // Search store names first, then combine with product name/category search
      const matchingStores = await db
        .select({ id: storesTable.id })
        .from(storesTable)
        .where(ilike(storesTable.name, `%${search}%`));
      const storeIdMatches = matchingStores.map(s => s.id);
      const searchCond = storeIdMatches.length > 0
        ? or(
            ilike(productsTable.name, `%${search}%`),
            ilike(productsTable.category, `%${search}%`),
            inArray(productsTable.storeId, storeIdMatches),
          )
        : or(
            ilike(productsTable.name, `%${search}%`),
            ilike(productsTable.category, `%${search}%`),
          );
      baseConditions.push(searchCond);
    }

    const pendingWhere = and(...baseConditions);
    const [products, totalResult] = await Promise.all([
      db.select().from(productsTable)
        .where(pendingWhere)
        .orderBy(desc(productsTable.createdAt))
        .limit(limitNum).offset(offset),
      db.select({ count: count() }).from(productsTable).where(pendingWhere),
    ]);

    const allStoreIds = [...new Set(products.map(p => p.storeId))];
    const stores = allStoreIds.length > 0
      ? await db.select().from(storesTable).where(inArray(storesTable.id, allStoreIds))
      : [];
    const storeMap = Object.fromEntries(stores.map(s => [s.id, s]));

    const total = totalResult[0]?.count ?? 0;
    res.json({
      products: products.map(p => ({ ...p, store: storeMap[p.storeId] })),
      total, page: pageNum, totalPages: Math.ceil(total / limitNum),
    });
  } catch (err) {
    req.log.error({ err }, "Get pending products error");
    res.status(500).json({ error: "ServerError", message: "Failed to fetch pending products" });
  }
});

// GET /admin/products/pending/stores — stores with pending product counts (for filter dropdown)
router.get("/products/pending/stores", async (req: AuthRequest, res) => {
  try {
    const pendingWhere = or(eq(productsTable.approvalStatus, "pending"), eq(productsTable.isApproved, false));
    const storeCounts = await db
      .select({ storeId: productsTable.storeId, count: count() })
      .from(productsTable)
      .where(pendingWhere)
      .groupBy(productsTable.storeId);

    if (storeCounts.length === 0) { res.json({ stores: [] }); return; }

    const storeIds = storeCounts.map(s => s.storeId);
    const stores = await db.select({ id: storesTable.id, name: storesTable.name })
      .from(storesTable)
      .where(inArray(storesTable.id, storeIds));
    const storeMap = Object.fromEntries(stores.map(s => [s.id, s]));

    res.json({
      stores: storeCounts
        .filter(s => storeMap[s.storeId])
        .map(s => ({ id: s.storeId, name: storeMap[s.storeId]?.name || 'Unknown', count: s.count }))
        .sort((a, b) => b.count - a.count),
    });
  } catch (err) {
    req.log.error({ err }, "Pending stores list error");
    res.status(500).json({ error: "ServerError" });
  }
});

// POST /admin/products/bulk-action — approve, reject, delete, activate, deactivate
router.post("/products/bulk-action", async (req: AuthRequest, res) => {
  try {
    const { action, productIds, reason } = req.body;
    if (!action || !Array.isArray(productIds) || productIds.length === 0) {
      res.status(400).json({ error: "ValidationError", message: "action and productIds are required" });
      return;
    }
    const validActions = ["approve", "reject", "delete", "activate", "deactivate"];
    if (!validActions.includes(action)) {
      res.status(400).json({ error: "ValidationError", message: `Invalid action: ${action}` });
      return;
    }

    if (action === "delete") {
      await db.delete(productsTable).where(inArray(productsTable.id, productIds));
    } else if (action === "approve") {
      await db.update(productsTable)
        .set({ isActive: true, isApproved: true, approvalStatus: "approved", updatedAt: new Date() })
        .where(inArray(productsTable.id, productIds));
    } else if (action === "reject") {
      await db.update(productsTable)
        .set({ isActive: false, isApproved: false, approvalStatus: "rejected", rejectionReason: reason || "Bulk rejected", updatedAt: new Date() })
        .where(inArray(productsTable.id, productIds));
    } else if (action === "activate") {
      await db.update(productsTable).set({ isActive: true, updatedAt: new Date() }).where(inArray(productsTable.id, productIds));
    } else if (action === "deactivate") {
      await db.update(productsTable).set({ isActive: false, updatedAt: new Date() }).where(inArray(productsTable.id, productIds));
    }

    const labels: Record<string, string> = { approve: "approved", reject: "rejected", delete: "deleted", activate: "activated", deactivate: "deactivated" };
    res.json({
      success: true,
      message: `${productIds.length} product${productIds.length !== 1 ? "s" : ""} ${labels[action]} successfully`,
      affectedCount: productIds.length,
    });
  } catch (err) {
    req.log.error({ err }, "Admin bulk action error");
    res.status(500).json({ error: "ServerError" });
  }
});

// PATCH (also support POST for backwards compat) /admin/products/:id/approve
router.patch("/products/:id/approve", async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const [product] = await db.select().from(productsTable).where(eq(productsTable.id, id)).limit(1);
    if (!product) { res.status(404).json({ error: "NotFound" }); return; }
    const [updated] = await db.update(productsTable)
      .set({ isActive: true, isApproved: true, approvalStatus: "approved", updatedAt: new Date() })
      .where(eq(productsTable.id, id)).returning();
    const { emitProductApproved } = await import("../socket/index.js");
    emitProductApproved(id, product.storeId, updated);
    res.json({ success: true, product: updated });
  } catch (err) {
    req.log.error({ err }, "Approve product error");
    res.status(500).json({ error: "ServerError" });
  }
});

router.post("/products/:id/approve", async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const [product] = await db.select().from(productsTable).where(eq(productsTable.id, id)).limit(1);
    if (!product) { res.status(404).json({ error: "NotFound" }); return; }
    const [updated] = await db.update(productsTable)
      .set({ isActive: true, isApproved: true, approvalStatus: "approved", updatedAt: new Date() })
      .where(eq(productsTable.id, id)).returning();
    const { emitProductApproved } = await import("../socket/index.js");
    emitProductApproved(id, product.storeId, updated);
    res.json({ success: true, product: updated });
  } catch (err) {
    req.log.error({ err }, "Approve product error");
    res.status(500).json({ error: "ServerError" });
  }
});

router.patch("/products/:id/reject", async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    if (!reason?.trim()) { res.status(400).json({ error: "Reason required" }); return; }
    const [product] = await db.select().from(productsTable).where(eq(productsTable.id, id)).limit(1);
    if (!product) { res.status(404).json({ error: "NotFound" }); return; }
    const [updated] = await db.update(productsTable)
      .set({ isActive: false, isApproved: false, approvalStatus: "rejected", rejectionReason: reason, updatedAt: new Date() })
      .where(eq(productsTable.id, id)).returning();
    const { emitProductRejected } = await import("../socket/index.js");
    emitProductRejected(id, product.storeId, reason);
    res.json({ success: true, product: updated });
  } catch (err) {
    req.log.error({ err }, "Reject product error");
    res.status(500).json({ error: "ServerError" });
  }
});

router.post("/products/:id/reject", async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const [product] = await db.select().from(productsTable).where(eq(productsTable.id, id)).limit(1);
    if (!product) { res.status(404).json({ error: "NotFound" }); return; }
    const [updated] = await db.update(productsTable)
      .set({ isActive: false, isApproved: false, approvalStatus: "rejected", rejectionReason: reason, updatedAt: new Date() })
      .where(eq(productsTable.id, id)).returning();
    const { emitProductRejected } = await import("../socket/index.js");
    emitProductRejected(id, product.storeId, reason || "No reason provided");
    res.json({ success: true, product: updated });
  } catch (err) {
    req.log.error({ err }, "Reject product error");
    res.status(500).json({ error: "ServerError" });
  }
});

// Ban/Unban user
router.patch("/users/:id/ban", async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    if (id === req.user!.userId) { res.status(400).json({ error: "CannotBanSelf" }); return; }
    const [user] = await db.update(usersTable)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(usersTable.id, id)).returning();
    if (!user) { res.status(404).json({ error: "NotFound" }); return; }
    const { emitUserBanned } = await import("../socket/index.js");
    emitUserBanned(id);
    res.json({ success: true, user, reason });
  } catch (err) {
    req.log.error({ err }, "Ban user error");
    res.status(500).json({ error: "ServerError" });
  }
});

router.patch("/users/:id/unban", async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const [user] = await db.update(usersTable)
      .set({ isActive: true, updatedAt: new Date() })
      .where(eq(usersTable.id, id)).returning();
    if (!user) { res.status(404).json({ error: "NotFound" }); return; }
    res.json({ success: true, user });
  } catch (err) {
    req.log.error({ err }, "Unban user error");
    res.status(500).json({ error: "ServerError" });
  }
});

// ── ADMIN: CREATE STORE DIRECTLY (auto-approved) ────────────
router.post("/stores", async (req: AuthRequest, res) => {
  try {
    const b = req.body as Record<string, any>;
    const required = ["name", "phone", "email", "address", "city", "province", "postalCode"];
    for (const k of required) {
      if (!b[k] || !String(b[k]).trim()) {
        res.status(400).json({ error: "ValidationError", message: `${k} is required` });
        return;
      }
    }
    // Try to parse lat/lng from Google Maps link if not provided
    let parsedLat: number | null = typeof b.lat === "number" ? b.lat : null;
    let parsedLng: number | null = typeof b.lng === "number" ? b.lng : null;
    if ((parsedLat === null || parsedLng === null) && typeof b.googleMapsLink === "string") {
      const m = b.googleMapsLink.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/)
        || b.googleMapsLink.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/)
        || b.googleMapsLink.match(/q=(-?\d+\.\d+),(-?\d+\.\d+)/);
      if (m) { parsedLat = parseFloat(m[1]); parsedLng = parseFloat(m[2]); }
    }
    // Fallback to 0/0 — admin can update via settings later
    if (parsedLat === null) parsedLat = 0;
    if (parsedLng === null) parsedLng = 0;

    let ownerId: string | null = b.ownerId ?? null;

    // Create new owner account if requested
    if (!ownerId && b.ownerEmail) {
      const email = String(b.ownerEmail).toLowerCase().trim();
      const [existing] = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
      if (existing) {
        ownerId = existing.id;
        if (existing.role === "CUSTOMER") {
          await db.update(usersTable).set({ role: "STORE_OWNER" }).where(eq(usersTable.id, existing.id));
        }
      } else {
        const tempPass = b.ownerPassword || `Owner@${Math.random().toString(36).slice(2, 8)}`;
        const passwordHash = await hashPassword(tempPass);
        const [newOwner] = await db.insert(usersTable).values({
          email,
          passwordHash,
          firstName: b.ownerFirstName || "Store",
          lastName: b.ownerLastName || "Owner",
          role: "STORE_OWNER",
          isVerified: true,
        }).returning();
        ownerId = newOwner.id;
      }
    }

    if (!ownerId) { res.status(400).json({ error: "ValidationError", message: "ownerId or ownerEmail required" }); return; }

    const baseSlug = String(b.name).toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "store";
    const slug = `${baseSlug}-${Math.random().toString(36).slice(2, 6)}`;

    const [store] = await db.insert(storesTable).values({
      ownerId,
      name: b.name,
      slug,
      branchName: b.branchName ?? null,
      tagline: b.tagline ?? null,
      description: b.description ?? null,
      phone: b.phone ?? null,
      email: b.email ?? null,
      logo: b.logo ?? null,
      banner: b.banner ?? null,
      cardImage: b.cardImage ?? null,
      address: b.address ?? null,
      city: b.city ?? null,
      province: b.province ?? null,
      postalCode: b.postalCode ?? null,
      lat: parsedLat,
      lng: parsedLng,
      googleMapsLink: b.googleMapsLink ?? null,
      openingHoursJson: b.openingHoursJson ?? {},
      slotDurationMinutes: Number(b.slotDurationMinutes) || 30,
      maxOrdersPerSlot: Number(b.maxOrdersPerSlot) || 5,
      pickupAvailable: b.pickupAvailable ?? true,
      curbsideAvailable: b.curbsideAvailable ?? false,
      deliveryAvailable: b.deliveryAvailable ?? false,
      minOrderAmount: Number(b.minOrderAmount) || 0,
      avgPrepTimeMinutes: Number(b.avgPrepTimeMinutes) || 15,
      amenityTags: b.amenityTags ?? [],
      isHalalCertified: b.isHalalCertified ?? false,
      halalCertNumber: b.halalCertNumber || null,
      halalCertBody: b.halalCertBody || null,
      halalCertExpiry: b.halalCertExpiry ? new Date(b.halalCertExpiry) : null,
      premiumFreshEnabled: b.premiumFreshEnabled ?? true,
      premiumFreshBadgeTitle: b.premiumFreshBadgeTitle ?? null,
      premiumFreshHeading: b.premiumFreshHeading ?? null,
      premiumFreshDesc: b.premiumFreshDesc ?? null,
      premiumFreshCutTags: b.premiumFreshCutTags ?? [],
      premiumFreshBullet1: b.premiumFreshBullet1 ?? null,
      premiumFreshBullet2: b.premiumFreshBullet2 ?? null,
      premiumFreshBullet3: b.premiumFreshBullet3 ?? null,
      premiumFreshImages: b.premiumFreshImages ?? [],
      // Auto-approved
      isApproved: true,
      isActive: true,
      isActiveManual: true,
      showOnWebsite: true,
      onboardingCompleted: true,
      storeStatus: "approved",
    }).returning();

    // Insert categories if provided
    if (Array.isArray(b.categories) && b.categories.length > 0) {
      const { categoriesTable } = await import("@workspace/db/schema");
      await db.insert(categoriesTable).values(
        b.categories.map((c: any, i: number) => {
          const name = typeof c === "string" ? c : c.name;
          return {
            storeId: store.id,
            name,
            slug: name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
            sortOrder: i,
            isActive: true,
          };
        })
      ).onConflictDoNothing();
    }

    const { emitStoreStatusChanged } = await import("../socket/index.js");
    emitStoreStatusChanged(store.id, "approved");
    res.status(201).json({ success: true, store });
  } catch (err: any) {
    req.log.error({ err }, "Admin create store error");
    res.status(500).json({ error: "ServerError", message: err.message });
  }
});

// ── ADMIN: SOFT DELETE STORE ────────────────────────────────
router.delete("/stores/:id", async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const [store] = await db.update(storesTable)
      .set({ storeStatus: "deleted", isActive: false, isActiveManual: false, showOnWebsite: false, updatedAt: new Date() })
      .where(eq(storesTable.id, id)).returning();
    if (!store) { res.status(404).json({ error: "NotFound" }); return; }
    const { emitStoreStatusChanged, emitStoreVisibilityChanged } = await import("../socket/index.js");
    emitStoreStatusChanged(id, "deleted");
    emitStoreVisibilityChanged(id, false);
    res.json({ success: true, store });
  } catch (err) {
    req.log.error({ err }, "Admin soft-delete store error");
    res.status(500).json({ error: "ServerError" });
  }
});

// ── ADMIN: ADD PRODUCT FOR A STORE (auto-approved) ──────────
router.post("/stores/:storeId/products", async (req: AuthRequest, res) => {
  try {
    const { storeId } = req.params;
    const [store] = await db.select().from(storesTable).where(eq(storesTable.id, storeId)).limit(1);
    if (!store) { res.status(404).json({ error: "NotFound", message: "Store not found" }); return; }

    const b = req.body as Record<string, any>;
    if (!b.name || b.price === undefined) {
      res.status(400).json({ error: "ValidationError", message: "name and price required" });
      return;
    }

    const baseSlug = String(b.name).toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "product";
    const slug = `${baseSlug}-${Math.random().toString(36).slice(2, 8)}`;

    const [product] = await db.insert(productsTable).values({
      storeId,
      slug,
      name: b.name,
      nameUrdu: b.nameUrdu ?? null,
      description: b.description ?? null,
      productType: b.productType ?? "PACKAGED",
      category: b.category ?? "OTHER",
      categoryId: b.categoryId ?? null,
      price: String(b.price),
      comparePrice: b.comparePrice ? String(b.comparePrice) : null,
      unit: b.unit ?? "piece",
      stockQty: b.stockQty ?? 999,
      lowStockThreshold: b.lowStockThreshold ?? 5,
      images: b.images ?? [],
      shortDesc: b.shortDesc ?? null,
      productDetails: b.productDetails ?? null,
      ingredients: b.ingredients ?? null,
      directions: b.directions ?? null,
      certBadges: b.certBadges ?? [],
      sizes: b.sizes ?? null,
      isHalalCertified: b.isHalalCertified ?? true,
      isFeatured: b.isFeatured ?? false,
      isActive: true,
      // Admin-added: auto-approved
      isApproved: true,
      approvalStatus: "approved",
      freshnessLabel: b.freshnessLabel ?? null,
      meatAnimalType: b.animalType ?? b.meatAnimalType ?? null,
      availableCuts: b.availableCuts ?? [],
      pricePerKg: b.pricePerKg ? String(b.pricePerKg) : null,
      sku: b.sku ?? null,
    }).returning();

    const { emitProductApproved } = await import("../socket/index.js");
    emitProductApproved(product.id, storeId, product);
    res.status(201).json({ success: true, product });
  } catch (err: any) {
    req.log.error({ err }, "Admin add product error");
    res.status(500).json({ error: "ServerError", message: err.message });
  }
});

// ── ADMIN: EDIT PRODUCT FOR A STORE ─────────────────────────
router.put("/stores/:storeId/products/:pid", async (req: AuthRequest, res) => {
  try {
    const { storeId, pid } = req.params;
    const [existing] = await db.select().from(productsTable)
      .where(and(eq(productsTable.id, pid), eq(productsTable.storeId, storeId))).limit(1);
    if (!existing) { res.status(404).json({ error: "NotFound" }); return; }

    const b = req.body as Record<string, any>;
    const u: Record<string, any> = { updatedAt: new Date() };
    const fields = ["name", "nameUrdu", "description", "productType", "category", "categoryId", "unit", "stockQty",
      "lowStockThreshold", "images", "shortDesc", "productDetails", "ingredients", "directions", "certBadges",
      "sizes", "isHalalCertified", "isFeatured", "isActive", "freshnessLabel", "availableCuts", "sku"];
    for (const f of fields) if (b[f] !== undefined) u[f] = b[f];
    if (b.animalType !== undefined) u.meatAnimalType = b.animalType;
    if (b.meatAnimalType !== undefined) u.meatAnimalType = b.meatAnimalType;
    if (b.price !== undefined) u.price = String(b.price);
    if (b.comparePrice !== undefined) u.comparePrice = b.comparePrice ? String(b.comparePrice) : null;
    if (b.pricePerKg !== undefined) u.pricePerKg = b.pricePerKg ? String(b.pricePerKg) : null;

    const [product] = await db.update(productsTable).set(u).where(eq(productsTable.id, pid)).returning();

    if (b.stockQty !== undefined && b.stockQty !== existing.stockQty) {
      const { emitProductStockUpdated } = await import("../socket/index.js");
      emitProductStockUpdated(pid, storeId, b.stockQty);
    }
    res.json({ success: true, product });
  } catch (err: any) {
    req.log.error({ err }, "Admin edit product error");
    res.status(500).json({ error: "ServerError", message: err.message });
  }
});

// ── Admin Reviews Management ───────────────────────────────────────────────

// GET /api/admin/reviews - list all reviews with user, store info
router.get("/reviews", async (req: AuthRequest, res) => {
  try {
    const { storeId, minRating, isPublic, limit = "50", offset = "0" } = req.query as any;
    const conditions = [];
    if (storeId) conditions.push(eq(reviewsTable.storeId, storeId));
    if (minRating) conditions.push(sql`${reviewsTable.rating} >= ${Number(minRating)}`);
    if (isPublic !== undefined) conditions.push(eq(reviewsTable.isPublic, isPublic === "true"));

    const rows = await db
      .select({
        id: reviewsTable.id,
        rating: reviewsTable.rating,
        comment: reviewsTable.comment,
        reply: reviewsTable.reply,
        repliedAt: reviewsTable.repliedAt,
        isPublic: reviewsTable.isPublic,
        createdAt: reviewsTable.createdAt,
        storeId: reviewsTable.storeId,
        storeName: storesTable.name,
        userId: reviewsTable.userId,
        userFirstName: usersTable.firstName,
        userLastName: usersTable.lastName,
        userEmail: usersTable.email,
        orderId: reviewsTable.orderId,
      })
      .from(reviewsTable)
      .leftJoin(storesTable, eq(reviewsTable.storeId, storesTable.id))
      .leftJoin(usersTable, eq(reviewsTable.userId, usersTable.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(reviewsTable.createdAt))
      .limit(Number(limit))
      .offset(Number(offset));

    res.json(rows);
  } catch (err) {
    req.log.error({ err }, "Admin list reviews error");
    res.status(500).json({ error: "ServerError" });
  }
});

// PATCH /api/admin/reviews/:id - toggle isPublic or add reply
router.patch("/reviews/:id", async (req: AuthRequest, res) => {
  try {
    const { isPublic, reply } = req.body;
    const updateData: any = {};
    if (isPublic !== undefined) updateData.isPublic = isPublic;
    if (reply !== undefined) {
      updateData.reply = reply;
      updateData.repliedAt = reply ? new Date() : null;
    }
    const [updated] = await db.update(reviewsTable).set(updateData).where(eq(reviewsTable.id, req.params.id)).returning();
    if (!updated) { res.status(404).json({ error: "NotFound" }); return; }
    res.json(updated);
  } catch (err) {
    req.log.error({ err }, "Admin patch review error");
    res.status(500).json({ error: "ServerError" });
  }
});

// DELETE /api/admin/reviews/:id - permanently delete a review
router.delete("/reviews/:id", async (req: AuthRequest, res) => {
  try {
    const [deleted] = await db.delete(reviewsTable).where(eq(reviewsTable.id, req.params.id)).returning();
    if (!deleted) { res.status(404).json({ error: "NotFound" }); return; }
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Admin delete review error");
    res.status(500).json({ error: "ServerError" });
  }
});

export default router;
