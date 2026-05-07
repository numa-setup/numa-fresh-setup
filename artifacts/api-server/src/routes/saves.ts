import { Router } from "express";
import { db } from "@workspace/db";
import {
  savedProductsTable,
  productsTable,
  storesTable,
} from "@workspace/db/schema";
import { and, desc, eq } from "drizzle-orm";
import { authenticate, AuthRequest } from "../middlewares/authenticate.js";

const router = Router();

/**
 * Round 10 / Fix #6 — Save List (wishlist) endpoints.
 *
 * GET    /api/saves              List the current user's saved products.
 * GET    /api/saves/ids          Return just the productIds the user has saved
 *                                (cheap call for cards/PDP heart state).
 * POST   /api/saves              Body { productId } — idempotent save.
 * DELETE /api/saves/:productId   Remove a save.
 */

// GET /api/saves — full list with product + store basics for the saved page
router.get("/", authenticate, async (req: AuthRequest, res) => {
  try {
    const rows = await db
      .select({
        savedAt: savedProductsTable.createdAt,
        product: productsTable,
        store: storesTable,
      })
      .from(savedProductsTable)
      .innerJoin(productsTable, eq(savedProductsTable.productId, productsTable.id))
      .innerJoin(storesTable, eq(productsTable.storeId, storesTable.id))
      .where(eq(savedProductsTable.userId, req.user!.userId))
      .orderBy(desc(savedProductsTable.createdAt));

    res.json({ items: rows });
  } catch (err) {
    req.log.error({ err }, "List saved products error");
    res.status(500).json({ error: "ServerError", message: "Failed to load saved products" });
  }
});

// GET /api/saves/ids — minimal payload for hydrating heart-state on lists
router.get("/ids", authenticate, async (req: AuthRequest, res) => {
  try {
    const rows = await db
      .select({ productId: savedProductsTable.productId })
      .from(savedProductsTable)
      .where(eq(savedProductsTable.userId, req.user!.userId));

    res.json({ ids: rows.map(r => r.productId) });
  } catch (err) {
    req.log.error({ err }, "List saved product ids error");
    res.status(500).json({ error: "ServerError", message: "Failed to load saved ids" });
  }
});

// POST /api/saves { productId } — idempotent
router.post("/", authenticate, async (req: AuthRequest, res) => {
  try {
    const productId = String(req.body?.productId || "").trim();
    if (!productId) {
      res.status(400).json({ error: "BadRequest", message: "productId is required" });
      return;
    }

    // Verify the product exists; otherwise we'd FK-fail on insert.
    const [product] = await db
      .select({ id: productsTable.id })
      .from(productsTable)
      .where(eq(productsTable.id, productId))
      .limit(1);
    if (!product) {
      res.status(404).json({ error: "NotFound", message: "Product not found" });
      return;
    }

    // Idempotent: if already saved, return ok without inserting.
    const [existing] = await db
      .select({ id: savedProductsTable.id })
      .from(savedProductsTable)
      .where(
        and(
          eq(savedProductsTable.userId, req.user!.userId),
          eq(savedProductsTable.productId, productId),
        ),
      )
      .limit(1);
    if (existing) {
      res.status(200).json({ saved: true, alreadySaved: true });
      return;
    }

    await db.insert(savedProductsTable).values({
      userId: req.user!.userId,
      productId,
    });
    res.status(201).json({ saved: true, alreadySaved: false });
  } catch (err) {
    req.log.error({ err }, "Save product error");
    res.status(500).json({ error: "ServerError", message: "Failed to save product" });
  }
});

// DELETE /api/saves/:productId
router.delete("/:productId", authenticate, async (req: AuthRequest, res) => {
  try {
    const productId = String(req.params.productId || "").trim();
    if (!productId) {
      res.status(400).json({ error: "BadRequest", message: "productId is required" });
      return;
    }

    await db
      .delete(savedProductsTable)
      .where(
        and(
          eq(savedProductsTable.userId, req.user!.userId),
          eq(savedProductsTable.productId, productId),
        ),
      );

    res.json({ saved: false });
  } catch (err) {
    req.log.error({ err }, "Unsave product error");
    res.status(500).json({ error: "ServerError", message: "Failed to remove saved product" });
  }
});

export default router;
