import { Router } from "express";
import { db } from "@workspace/db";
import { categoriesTable, storesTable } from "@workspace/db/schema";
import { eq, and, asc } from "drizzle-orm";
import { authenticate, authorize, AuthRequest } from "../middlewares/authenticate.js";

const router = Router();

// Public: get categories for a store by slug
router.get("/stores/:slug/categories", async (req, res) => {
  try {
    const [store] = await db.select({ id: storesTable.id })
      .from(storesTable).where(eq(storesTable.slug, req.params.slug)).limit(1);
    if (!store) { res.status(404).json({ error: "StoreNotFound" }); return; }

    const cats = await db.select().from(categoriesTable)
      .where(and(eq(categoriesTable.storeId, store.id), eq(categoriesTable.isActive, true)))
      .orderBy(asc(categoriesTable.sortOrder));
    res.json(cats);
  } catch (err: any) {
    res.status(500).json({ error: "ServerError", message: err.message });
  }
});

// Store owner: manage their categories
router.get("/store/categories", authenticate, authorize("STORE_OWNER", "ADMIN"), async (req: AuthRequest, res) => {
  try {
    const [store] = await db.select({ id: storesTable.id })
      .from(storesTable).where(eq(storesTable.ownerId, req.user!.userId)).limit(1);
    if (!store) { res.status(404).json({ error: "NoStore" }); return; }

    const cats = await db.select().from(categoriesTable)
      .where(eq(categoriesTable.storeId, store.id))
      .orderBy(asc(categoriesTable.sortOrder));
    res.json(cats);
  } catch (err: any) {
    res.status(500).json({ error: "ServerError", message: err.message });
  }
});

router.post("/store/categories", authenticate, authorize("STORE_OWNER", "ADMIN"), async (req: AuthRequest, res) => {
  try {
    const [store] = await db.select({ id: storesTable.id })
      .from(storesTable).where(eq(storesTable.ownerId, req.user!.userId)).limit(1);
    if (!store) { res.status(404).json({ error: "NoStore" }); return; }

    const { name, sortOrder = 0 } = req.body;
    if (!name?.trim()) { res.status(400).json({ error: "Name required" }); return; }

    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const [cat] = await db.insert(categoriesTable).values({
      storeId: store.id, name: name.trim(), slug, sortOrder,
    }).returning();
    res.status(201).json(cat);
  } catch (err: any) {
    res.status(500).json({ error: "ServerError", message: err.message });
  }
});

router.patch("/store/categories/:id", authenticate, authorize("STORE_OWNER", "ADMIN"), async (req: AuthRequest, res) => {
  try {
    const [store] = await db.select({ id: storesTable.id })
      .from(storesTable).where(eq(storesTable.ownerId, req.user!.userId)).limit(1);
    if (!store) { res.status(404).json({ error: "NoStore" }); return; }

    const { name, isActive, sortOrder } = req.body;
    const updates: Record<string, unknown> = {};
    if (name !== undefined) {
      updates.name = name;
      updates.slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    }
    if (isActive !== undefined) updates.isActive = isActive;
    if (sortOrder !== undefined) updates.sortOrder = sortOrder;

    const [cat] = await db.update(categoriesTable)
      .set(updates)
      .where(and(eq(categoriesTable.id, req.params.id), eq(categoriesTable.storeId, store.id)))
      .returning();
    res.json(cat);
  } catch (err: any) {
    res.status(500).json({ error: "ServerError", message: err.message });
  }
});

router.delete("/store/categories/:id", authenticate, authorize("STORE_OWNER", "ADMIN"), async (req: AuthRequest, res) => {
  try {
    const [store] = await db.select({ id: storesTable.id })
      .from(storesTable).where(eq(storesTable.ownerId, req.user!.userId)).limit(1);
    if (!store) { res.status(404).json({ error: "NoStore" }); return; }

    await db.delete(categoriesTable)
      .where(and(eq(categoriesTable.id, req.params.id), eq(categoriesTable.storeId, store.id)));
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: "ServerError", message: err.message });
  }
});

// Reorder categories
router.patch("/store/categories/reorder", authenticate, authorize("STORE_OWNER", "ADMIN"), async (req: AuthRequest, res) => {
  try {
    const { order } = req.body as { order: Array<{ id: string; sortOrder: number }> };
    await Promise.all(order.map(({ id, sortOrder }) =>
      db.update(categoriesTable).set({ sortOrder }).where(eq(categoriesTable.id, id))
    ));
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: "ServerError", message: err.message });
  }
});

// Admin: get categories for any store
router.get("/admin/categories/:storeId", authenticate, authorize("ADMIN"), async (req: AuthRequest, res) => {
  try {
    const cats = await db.select().from(categoriesTable)
      .where(eq(categoriesTable.storeId, req.params.storeId))
      .orderBy(asc(categoriesTable.sortOrder));
    res.json(cats);
  } catch (err: any) {
    res.status(500).json({ error: "ServerError", message: err.message });
  }
});

export default router;
