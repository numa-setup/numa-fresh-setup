import { Router } from "express";
import { db } from "@workspace/db";
import { storesTable, productsTable, reviewsTable, pickupSlotsTable, usersTable, ordersTable } from "@workspace/db/schema";
import { eq, and, or, ilike, desc, sql, count } from "drizzle-orm";
import { authenticate, authorize, AuthRequest } from "../middlewares/authenticate.js";
import { optionalAuthenticate } from "../middlewares/optional-authenticate.js";
import { ensureStoreWelcome } from "../lib/messaging.js";

const router = Router();

// GET /api/stores - List all active stores
router.get("/", async (req, res) => {
  try {
    const { city, search, page = "1", limit = "20" } = req.query as Record<string, string>;
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, parseInt(limit) || 20);
    const offset = (pageNum - 1) * limitNum;

    const conditions = [eq(storesTable.isActive, true), eq(storesTable.isApproved, true), eq(storesTable.showOnWebsite, true)];

    if (city) {
      conditions.push(ilike(storesTable.city, `%${city}%`));
    }
    if (search) {
      conditions.push(
        or(
          ilike(storesTable.name,     `%${search}%`),
          ilike(storesTable.address,  `%${search}%`),
          ilike(storesTable.city,     `%${search}%`),
          ilike(storesTable.province, `%${search}%`),
        )!,
      );
    }

    const [stores, totalResult] = await Promise.all([
      db.select().from(storesTable).where(and(...conditions)).orderBy(desc(storesTable.rating)).limit(limitNum).offset(offset),
      db.select({ count: count() }).from(storesTable).where(and(...conditions)),
    ]);

    const total = totalResult[0]?.count ?? 0;

    res.json({
      stores,
      total,
      page: pageNum,
      totalPages: Math.ceil(total / limitNum),
    });
  } catch (err) {
    req.log.error({ err }, "List stores error");
    res.status(500).json({ error: "ServerError", message: "Failed to fetch stores" });
  }
});

// GET /api/stores/featured
router.get("/featured", async (req, res) => {
  try {
    const stores = await db
      .select()
      .from(storesTable)
      .where(and(eq(storesTable.isActive, true), eq(storesTable.isApproved, true), eq(storesTable.showOnWebsite, true)))
      .orderBy(desc(storesTable.rating))
      .limit(6);

    res.json(stores);
  } catch (err) {
    req.log.error({ err }, "Featured stores error");
    res.status(500).json({ error: "ServerError", message: "Failed to fetch featured stores" });
  }
});

// GET /api/stores/:storeSlug - Store detail
router.get("/:storeSlug", optionalAuthenticate, async (req: AuthRequest, res) => {
  try {
    const { storeSlug } = req.params;
    const [store] = await db.select().from(storesTable).where(eq(storesTable.slug, storeSlug)).limit(1);

    if (!store) {
      res.status(404).json({ error: "NotFound", message: "Store not found" });
      return;
    }

    // Approval gate: only approved+active stores are visible publicly. The
    // store's own owner and any ADMIN can still view (so the owner dashboard
    // and admin tools keep working). Anyone else gets a 404 — exposing
    // "exists but pending" would leak the slug and let unapproved stores be
    // shopped via direct URL.
    const isOwner = req.user?.userId === store.ownerId;
    const isAdmin = req.user?.role === "ADMIN";
    const isPubliclyVisible =
      store.isApproved &&
      store.isActive &&
      store.storeStatus === "approved" &&
      store.showOnWebsite;
    if (!isPubliclyVisible && !isOwner && !isAdmin) {
      res.status(404).json({ error: "NotFound", message: "Store not found" });
      return;
    }

    // Idempotently seed a welcome chat from this store to the visiting customer.
    if (req.user?.role === "CUSTOMER") {
      ensureStoreWelcome(store.id, req.user.userId).catch((err) => {
        req.log.error({ err, storeId: store.id, userId: req.user!.userId }, "ensureStoreWelcome failed");
      });
    }

    const [productsCountResult, recentReviews] = await Promise.all([
      db.select({ count: count() }).from(productsTable).where(and(eq(productsTable.storeId, store.id), eq(productsTable.isActive, true), eq(productsTable.isApproved, true))),
      db.select({
        id: reviewsTable.id,
        userId: reviewsTable.userId,
        storeId: reviewsTable.storeId,
        orderId: reviewsTable.orderId,
        rating: reviewsTable.rating,
        comment: reviewsTable.comment,
        reply: reviewsTable.reply,
        isPublic: reviewsTable.isPublic,
        createdAt: reviewsTable.createdAt,
        userFirstName: usersTable.firstName,
        userLastName: usersTable.lastName,
        userAvatar: usersTable.avatar,
      })
        .from(reviewsTable)
        .leftJoin(usersTable, eq(reviewsTable.userId, usersTable.id))
        .where(and(eq(reviewsTable.storeId, store.id), eq(reviewsTable.isPublic, true)))
        .orderBy(desc(reviewsTable.createdAt))
        .limit(5),
    ]);

    const reviewsMapped = recentReviews.map(r => ({
      id: r.id,
      userId: r.userId,
      storeId: r.storeId,
      orderId: r.orderId,
      rating: r.rating,
      comment: r.comment,
      reply: r.reply,
      isPublic: r.isPublic,
      createdAt: r.createdAt,
      user: { firstName: r.userFirstName ?? "", lastName: r.userLastName ?? "", avatar: r.userAvatar ?? null },
    }));

    res.json({
      ...store,
      productsCount: productsCountResult[0]?.count ?? 0,
      recentReviews: reviewsMapped,
    });
  } catch (err) {
    req.log.error({ err }, "Get store error");
    res.status(500).json({ error: "ServerError", message: "Failed to fetch store" });
  }
});

// GET /api/stores/:storeSlug/products
router.get("/:storeSlug/products", async (req, res) => {
  try {
    const { storeSlug } = req.params;
    const { category, search, productType, page = "1", limit = "40" } = req.query as Record<string, string>;
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, parseInt(limit) || 40);
    const offset = (pageNum - 1) * limitNum;

    const [store] = await db.select({ id: storesTable.id }).from(storesTable).where(eq(storesTable.slug, storeSlug)).limit(1);
    if (!store) {
      res.status(404).json({ error: "NotFound", message: "Store not found" });
      return;
    }

    const conditions = [eq(productsTable.storeId, store.id), eq(productsTable.isActive, true), eq(productsTable.isApproved, true)];
    if (category) conditions.push(ilike(productsTable.category, `%${category}%`));
    if (search) conditions.push(or(ilike(productsTable.name, `%${search}%`), ilike(productsTable.category, `%${search}%`))!);
    if (productType) conditions.push(eq(productsTable.productType, productType as any));

    const [products, totalResult] = await Promise.all([
      db.select().from(productsTable).where(and(...conditions)).orderBy(desc(productsTable.isFeatured), desc(productsTable.createdAt)).limit(limitNum).offset(offset),
      db.select({ count: count() }).from(productsTable).where(and(...conditions)),
    ]);

    const total = totalResult[0]?.count ?? 0;
    const productsWithStore = products.map(p => ({
      ...p,
      isAvailable: p.isActive && (p.stockQty ?? 0) > 0,
      store,
    }));

    res.json({ products: productsWithStore, total, page: pageNum, totalPages: Math.ceil(total / limitNum) });
  } catch (err) {
    req.log.error({ err }, "Get store products error");
    res.status(500).json({ error: "ServerError", message: "Failed to fetch store products" });
  }
});

// GET /api/stores/:storeSlug/reviews
router.get("/:storeSlug/reviews", async (req, res) => {
  try {
    const { storeSlug } = req.params;
    const { page = "1", limit = "10" } = req.query as Record<string, string>;
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(50, parseInt(limit) || 10);
    const offset = (pageNum - 1) * limitNum;

    const [store] = await db.select({ id: storesTable.id }).from(storesTable).where(eq(storesTable.slug, storeSlug)).limit(1);
    if (!store) {
      res.status(404).json({ error: "NotFound", message: "Store not found" });
      return;
    }

    const [reviews, totalResult, avgResult] = await Promise.all([
      db.select({
        id: reviewsTable.id,
        userId: reviewsTable.userId,
        storeId: reviewsTable.storeId,
        orderId: reviewsTable.orderId,
        rating: reviewsTable.rating,
        comment: reviewsTable.comment,
        reply: reviewsTable.reply,
        isPublic: reviewsTable.isPublic,
        createdAt: reviewsTable.createdAt,
        userFirstName: usersTable.firstName,
        userLastName: usersTable.lastName,
        userAvatar: usersTable.avatar,
      }).from(reviewsTable)
        .leftJoin(usersTable, eq(reviewsTable.userId, usersTable.id))
        .where(and(eq(reviewsTable.storeId, store.id), eq(reviewsTable.isPublic, true)))
        .orderBy(desc(reviewsTable.createdAt))
        .limit(limitNum).offset(offset),
      db.select({ count: count() }).from(reviewsTable).where(eq(reviewsTable.storeId, store.id)),
      db.select({ avg: sql<number>`AVG(rating)::float` }).from(reviewsTable).where(eq(reviewsTable.storeId, store.id)),
    ]);

    const total = totalResult[0]?.count ?? 0;
    const averageRating = avgResult[0]?.avg ?? 0;

    const reviewsMapped = reviews.map(r => ({
      id: r.id,
      userId: r.userId,
      storeId: r.storeId,
      orderId: r.orderId,
      rating: r.rating,
      comment: r.comment,
      reply: r.reply,
      isPublic: r.isPublic,
      createdAt: r.createdAt,
      user: { firstName: r.userFirstName ?? "", lastName: r.userLastName ?? "", avatar: r.userAvatar ?? null },
    }));

    res.json({
      reviews: reviewsMapped,
      total,
      averageRating: Math.round(averageRating * 10) / 10,
      ratingBreakdown: { "1": 0, "2": 0, "3": 0, "4": 0, "5": 0 },
    });
  } catch (err) {
    req.log.error({ err }, "Get store reviews error");
    res.status(500).json({ error: "ServerError", message: "Failed to fetch reviews" });
  }
});

// GET /api/stores/:storeSlug/pickup-slots
router.get("/:storeSlug/pickup-slots", async (req, res) => {
  try {
    const { storeSlug } = req.params;
    const [store] = await db.select({ id: storesTable.id }).from(storesTable).where(eq(storesTable.slug, storeSlug)).limit(1);
    if (!store) {
      res.status(404).json({ error: "NotFound", message: "Store not found" });
      return;
    }

    const slots = await db.select().from(pickupSlotsTable)
      .where(and(eq(pickupSlotsTable.storeId, store.id), eq(pickupSlotsTable.isAvailable, true)))
      .orderBy(pickupSlotsTable.date);

    const slotsWithSpots = slots.map(s => ({
      ...s,
      spotsLeft: s.maxOrders - s.bookedOrders,
    }));

    res.json(slotsWithSpots);
  } catch (err) {
    req.log.error({ err }, "Get pickup slots error");
    res.status(500).json({ error: "ServerError", message: "Failed to fetch pickup slots" });
  }
});

export default router;
