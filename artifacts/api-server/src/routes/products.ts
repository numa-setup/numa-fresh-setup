import { Router } from "express";
import { db } from "@workspace/db";
import { productsTable, storesTable } from "@workspace/db/schema";
import { eq, and, ilike, desc, count, inArray, ne, or } from "drizzle-orm";
import { authenticate, authorize, AuthRequest } from "../middlewares/authenticate.js";

const router = Router();

// GET /api/products - List/search products
router.get("/", async (req, res) => {
  try {
    const { search, category, productType, isFreshMeat, page = "1", limit = "40" } = req.query as Record<string, string>;
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, parseInt(limit) || 40);
    const offset = (pageNum - 1) * limitNum;

    const conditions: any[] = [eq(productsTable.isActive, true), eq(productsTable.isApproved, true)];
    if (search) conditions.push(ilike(productsTable.name, `%${search}%`));
    if (category) conditions.push(ilike(productsTable.category, `%${category}%`));
    if (productType) conditions.push(eq(productsTable.productType, productType as any));
    if (isFreshMeat === "true") conditions.push(eq(productsTable.isFreshMeat, true));

    const [products, totalResult] = await Promise.all([
      db.select().from(productsTable).where(and(...conditions)).orderBy(desc(productsTable.isFeatured), desc(productsTable.createdAt)).limit(limitNum).offset(offset),
      db.select({ count: count() }).from(productsTable).where(and(...conditions)),
    ]);

    const storeIds = [...new Set(products.map(p => p.storeId))];
    const stores = storeIds.length > 0
      ? await db.select().from(storesTable).where(inArray(storesTable.id, storeIds))
      : [];
    const storeMap = Object.fromEntries(stores.map(s => [s.id, s]));

    const productsWithStore = products.map(p => ({ ...p, store: storeMap[p.storeId] }));
    const total = totalResult[0]?.count ?? 0;

    res.json({ products: productsWithStore, total, page: pageNum, totalPages: Math.ceil(total / limitNum) });
  } catch (err) {
    req.log.error({ err }, "List products error");
    res.status(500).json({ error: "ServerError", message: "Failed to fetch products" });
  }
});

// GET /api/products/featured
router.get("/featured", async (req, res) => {
  try {
    const [freshMeat, produce, spices, packaged] = await Promise.all([
      db.select().from(productsTable).where(and(eq(productsTable.isActive, true), eq(productsTable.isApproved, true), eq(productsTable.isFreshMeat, true))).orderBy(desc(productsTable.isFeatured)).limit(8),
      db.select().from(productsTable).where(and(eq(productsTable.isActive, true), eq(productsTable.isApproved, true), eq(productsTable.productType, "PRODUCE"))).orderBy(desc(productsTable.isFeatured)).limit(8),
      db.select().from(productsTable).where(and(eq(productsTable.isActive, true), eq(productsTable.isApproved, true), eq(productsTable.productType, "SPICES"))).orderBy(desc(productsTable.isFeatured)).limit(8),
      db.select().from(productsTable).where(and(eq(productsTable.isActive, true), eq(productsTable.isApproved, true), eq(productsTable.productType, "PACKAGED"))).orderBy(desc(productsTable.isFeatured)).limit(8),
    ]);

    const allStoreIds = [
      ...new Set([
        ...freshMeat.map(p => p.storeId),
        ...produce.map(p => p.storeId),
        ...spices.map(p => p.storeId),
        ...packaged.map(p => p.storeId),
      ]),
    ];

    const stores = allStoreIds.length > 0
      ? await db.select().from(storesTable).where(inArray(storesTable.id, allStoreIds))
      : [];
    const storeMap = Object.fromEntries(stores.map(s => [s.id, s]));

    const attach = (products: typeof productsTable.$inferSelect[]) =>
      products.map(p => ({ ...p, store: storeMap[p.storeId] }));

    res.json({
      freshMeat: attach(freshMeat),
      produce: attach(produce),
      spices: attach(spices),
      packaged: attach(packaged),
      eidSpecials: attach(freshMeat.slice(0, 4)),
    });
  } catch (err) {
    req.log.error({ err }, "Featured products error");
    res.status(500).json({ error: "ServerError", message: "Failed to fetch featured products" });
  }
});

// GET /api/products/:productSlug
// Similar products — same product name/keyword, any store (different brand)
router.get("/:productSlug/related", async (req, res) => {
  try {
    const { productSlug } = req.params;
    const limit = Math.min(20, parseInt((req.query.limit as string) || "8") || 8);

    const [base] = await db.select().from(productsTable).where(eq(productsTable.slug, productSlug)).limit(1);
    if (!base) {
      res.json({ products: [] });
      return;
    }

    // Extract meaningful keywords from product name (strip brand/qualifier noise)
    const STOP_WORDS = new Set(['fresh', 'halal', 'organic', 'natural', 'premium', 'special', 'extra',
      'cut', 'whole', 'sliced', 'boneless', 'bone', 'in', 'with', 'and', 'the', 'to', 'from',
      'free', 'range', 'grade', 'a', 'no', 'hormone', 'certified']);
    const keywords = (base.name || '')
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .split(/\s+/)
      .filter(w => w.length > 2 && !STOP_WORDS.has(w));

    const storeId = req.query.storeId as string | undefined;

    const baseConditions: any[] = [
      eq(productsTable.isActive, true),
      eq(productsTable.isApproved, true),
      ne(productsTable.id, base.id),
    ];
    if (storeId) baseConditions.push(eq(productsTable.storeId, storeId));

    // Name-only match: ALL keywords must appear in the name (AND), so "Chicken Breast"
    // matches "Boneless Chicken Breast" but never "Chicken Wings" or "Chicken Curry".
    // No category/type fallback — if nothing matches by name, return empty.
    let products: typeof productsTable.$inferSelect[] = [];
    if (keywords.length > 0) {
      const nameConditions = keywords.map(kw => ilike(productsTable.name, `%${kw}%`));
      products = await db.select()
        .from(productsTable)
        .where(and(...baseConditions, ...nameConditions))
        .orderBy(desc(productsTable.isFeatured), desc(productsTable.createdAt))
        .limit(limit);
    }

    // Attach minimal store info
    const storeIds = Array.from(new Set(products.map(p => p.storeId).filter(Boolean)));
    const stores = storeIds.length
      ? await db.select({ id: storesTable.id, name: storesTable.name, slug: storesTable.slug }).from(storesTable).where(inArray(storesTable.id, storeIds))
      : [];
    const storeById = new Map(stores.map(s => [s.id, s]));
    res.json({ products: products.map(p => ({ ...p, store: storeById.get(p.storeId) || null })) });
  } catch (err) {
    req.log.error({ err }, "Related products error");
    res.status(500).json({ error: "ServerError", message: "Failed to fetch related products" });
  }
});

router.get("/:productSlug", async (req, res) => {
  try {
    const { productSlug } = req.params;
    const [product] = await db.select().from(productsTable).where(eq(productsTable.slug, productSlug)).limit(1);

    if (!product || !product.isApproved || !product.isActive) {
      res.status(404).json({ error: "NotFound", message: "Product not found" });
      return;
    }

    const [store] = await db.select().from(storesTable).where(eq(storesTable.id, product.storeId)).limit(1);
    res.json({ ...product, store });
  } catch (err) {
    req.log.error({ err }, "Get product error");
    res.status(500).json({ error: "ServerError", message: "Failed to fetch product" });
  }
});

// STORE PORTAL PRODUCTS
// GET /api/store-portal/products
router.get("/store-portal/list", authenticate, authorize("STORE_OWNER", "STORE_STAFF", "ADMIN"), async (req: AuthRequest, res) => {
  try {
    const { page = "1", limit = "50" } = req.query as Record<string, string>;
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, parseInt(limit) || 50);
    const offset = (pageNum - 1) * limitNum;

    const [store] = await db.select({ id: storesTable.id }).from(storesTable).where(eq(storesTable.ownerId, req.user!.userId)).limit(1);
    if (!store) {
      res.status(404).json({ error: "NotFound", message: "Store not found" });
      return;
    }

    const [products, totalResult] = await Promise.all([
      db.select().from(productsTable).where(eq(productsTable.storeId, store.id)).orderBy(desc(productsTable.createdAt)).limit(limitNum).offset(offset),
      db.select({ count: count() }).from(productsTable).where(eq(productsTable.storeId, store.id)),
    ]);

    const total = totalResult[0]?.count ?? 0;
    res.json({ products: products.map(p => ({ ...p, store })), total, page: pageNum, totalPages: Math.ceil(total / limitNum) });
  } catch (err) {
    req.log.error({ err }, "Store portal products error");
    res.status(500).json({ error: "ServerError", message: "Failed to fetch products" });
  }
});

export default router;
