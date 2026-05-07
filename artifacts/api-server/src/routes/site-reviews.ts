import { Router } from "express";
import { db } from "@workspace/db";
import { siteReviewsTable, storesTable, usersTable } from "@workspace/db/schema";
import { eq, and, desc, asc } from "drizzle-orm";
import { authenticate, type AuthRequest } from "../middlewares/authenticate.js";
import { optionalAuthenticate } from "../middlewares/optional-authenticate.js";

const router = Router();

// ── Public: get approved platform reviews (featured first) ──────────────
router.get("/platform", async (req, res) => {
  try {
    const rows = await db
      .select()
      .from(siteReviewsTable)
      .where(and(eq(siteReviewsTable.targetType, "platform"), eq(siteReviewsTable.isApproved, true)))
      .orderBy(desc(siteReviewsTable.isFeatured), desc(siteReviewsTable.createdAt))
      .limit(20);
    res.json(rows);
  } catch (err) {
    console.error("site-reviews platform error", err);
    res.status(500).json({ error: "ServerError" });
  }
});

// ── Public: get approved reviews for a store ──────────────────────────
router.get("/store/:storeId", async (req, res) => {
  try {
    const rows = await db
      .select()
      .from(siteReviewsTable)
      .where(and(
        eq(siteReviewsTable.targetType, "store"),
        eq(siteReviewsTable.storeId, req.params.storeId),
        eq(siteReviewsTable.isApproved, true),
      ))
      .orderBy(desc(siteReviewsTable.createdAt))
      .limit(50);
    res.json(rows);
  } catch (err) {
    console.error("site-reviews store error", err);
    res.status(500).json({ error: "ServerError" });
  }
});

// ── Public: get approved reviews for a product ───────────────────────
router.get("/product/:productSlug", async (req, res) => {
  try {
    const rows = await db
      .select()
      .from(siteReviewsTable)
      .where(and(
        eq(siteReviewsTable.targetType, "product"),
        eq(siteReviewsTable.productSlug, req.params.productSlug),
        eq(siteReviewsTable.isApproved, true),
      ))
      .orderBy(desc(siteReviewsTable.createdAt))
      .limit(50);
    res.json(rows);
  } catch (err) {
    console.error("site-reviews product error", err);
    res.status(500).json({ error: "ServerError" });
  }
});

// ── Authenticated: submit a review ────────────────────────────────────
router.post("/", optionalAuthenticate, async (req: AuthRequest, res) => {
  try {
    const { targetType, storeId, productSlug, authorName, rating, comment } = req.body || {};

    if (!["platform", "store", "product"].includes(targetType)) {
      res.status(400).json({ error: "ValidationError", message: "Invalid targetType" });
      return;
    }
    if (!authorName || typeof authorName !== "string" || !authorName.trim()) {
      res.status(400).json({ error: "ValidationError", message: "authorName is required" });
      return;
    }
    const ratingNum = parseInt(rating);
    if (isNaN(ratingNum) || ratingNum < 1 || ratingNum > 5) {
      res.status(400).json({ error: "ValidationError", message: "rating must be 1-5" });
      return;
    }
    if (targetType === "store" && !storeId) {
      res.status(400).json({ error: "ValidationError", message: "storeId required for store review" });
      return;
    }
    if (targetType === "product" && !productSlug) {
      res.status(400).json({ error: "ValidationError", message: "productSlug required for product review" });
      return;
    }

    // Store owners may only submit platform reviews
    if (req.user?.role === "STORE_OWNER" && targetType !== "platform") {
      res.status(403).json({ error: "Forbidden", message: "Store owners may only submit platform reviews" });
      return;
    }

    const [review] = await db.insert(siteReviewsTable).values({
      targetType,
      storeId: targetType === "store" ? storeId : null,
      productSlug: targetType === "product" ? productSlug : null,
      authorId: req.user?.userId ?? null,
      authorName: authorName.trim(),
      rating: ratingNum,
      comment: comment?.trim() || null,
      isApproved: false,
      isFeatured: false,
    }).returning();

    res.status(201).json(review);
  } catch (err) {
    console.error("site-reviews submit error", err);
    res.status(500).json({ error: "ServerError" });
  }
});

// ── Admin: list all reviews ───────────────────────────────────────────
router.get("/admin", authenticate, async (req: AuthRequest, res) => {
  try {
    if (req.user!.role !== "ADMIN") { res.status(403).json({ error: "Forbidden" }); return; }
    const { targetType, isApproved } = req.query as Record<string, string>;
    const conds: any[] = [];
    if (targetType) conds.push(eq(siteReviewsTable.targetType, targetType as any));
    if (isApproved === "true") conds.push(eq(siteReviewsTable.isApproved, true));
    if (isApproved === "false") conds.push(eq(siteReviewsTable.isApproved, false));

    const rows = await db
      .select()
      .from(siteReviewsTable)
      .where(conds.length ? (conds.length === 1 ? conds[0] : and(...conds)) : undefined)
      .orderBy(asc(siteReviewsTable.isApproved), desc(siteReviewsTable.createdAt))
      .limit(200);

    // Enrich with store names
    const storeIds = [...new Set(rows.map(r => r.storeId).filter(Boolean))] as string[];
    const stores = storeIds.length
      ? await db.select({ id: storesTable.id, name: storesTable.name }).from(storesTable).where(eq(storesTable.id, storeIds[0]))
      : [];
    // Fetch all at once using individual queries when multiple store IDs exist
    const storeMap = new Map<string, string>();
    if (storeIds.length > 0) {
      for (const sid of storeIds) {
        const [s] = await db.select({ id: storesTable.id, name: storesTable.name }).from(storesTable).where(eq(storesTable.id, sid)).limit(1);
        if (s) storeMap.set(s.id, s.name);
      }
    }

    res.json(rows.map(r => ({ ...r, storeName: r.storeId ? storeMap.get(r.storeId) ?? null : null })));
  } catch (err) {
    console.error("site-reviews admin list error", err);
    res.status(500).json({ error: "ServerError" });
  }
});

// ── Admin: approve ────────────────────────────────────────────────────
router.patch("/admin/:id/approve", authenticate, async (req: AuthRequest, res) => {
  try {
    if (req.user!.role !== "ADMIN") { res.status(403).json({ error: "Forbidden" }); return; }
    const [updated] = await db.update(siteReviewsTable)
      .set({ isApproved: true })
      .where(eq(siteReviewsTable.id, req.params.id))
      .returning();
    if (!updated) { res.status(404).json({ error: "NotFound" }); return; }
    res.json(updated);
  } catch (err) {
    console.error("site-reviews approve error", err);
    res.status(500).json({ error: "ServerError" });
  }
});

// ── Admin: reject/delete ──────────────────────────────────────────────
router.delete("/admin/:id", authenticate, async (req: AuthRequest, res) => {
  try {
    if (req.user!.role !== "ADMIN") { res.status(403).json({ error: "Forbidden" }); return; }
    await db.delete(siteReviewsTable).where(eq(siteReviewsTable.id, req.params.id));
    res.status(204).end();
  } catch (err) {
    console.error("site-reviews delete error", err);
    res.status(500).json({ error: "ServerError" });
  }
});

// ── Admin: toggle feature (platform reviews only) ─────────────────────
router.patch("/admin/:id/feature", authenticate, async (req: AuthRequest, res) => {
  try {
    if (req.user!.role !== "ADMIN") { res.status(403).json({ error: "Forbidden" }); return; }
    const [current] = await db.select().from(siteReviewsTable).where(eq(siteReviewsTable.id, req.params.id)).limit(1);
    if (!current) { res.status(404).json({ error: "NotFound" }); return; }
    const [updated] = await db.update(siteReviewsTable)
      .set({ isFeatured: !current.isFeatured })
      .where(eq(siteReviewsTable.id, req.params.id))
      .returning();
    res.json(updated);
  } catch (err) {
    console.error("site-reviews feature error", err);
    res.status(500).json({ error: "ServerError" });
  }
});

export default router;
