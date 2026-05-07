import { Router } from "express";
import { db } from "@workspace/db";
import { storesTable, productsTable, siteReviewsTable } from "@workspace/db/schema";
import { eq, and, count } from "drizzle-orm";

const router = Router();

router.get("/stats", async (_req, res) => {
  try {
    const [[storeRow], [productRow], [reviewRow]] = await Promise.all([
      db.select({ count: count() }).from(storesTable).where(and(eq(storesTable.isApproved, true), eq(storesTable.isActive, true))),
      db.select({ count: count() }).from(productsTable).where(eq(productsTable.isActive, true)),
      db.select({ count: count() }).from(siteReviewsTable).where(eq(siteReviewsTable.isApproved, true)),
    ]);
    res.json({
      storeCount: storeRow?.count ?? 0,
      productCount: productRow?.count ?? 0,
      reviewCount: reviewRow?.count ?? 0,
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch stats" });
  }
});

export default router;
