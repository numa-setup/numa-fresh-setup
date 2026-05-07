import { Router } from "express";
import { db } from "@workspace/db";
import { pickupSlotsTable, storesTable } from "@workspace/db/schema";
import { eq, and, gte } from "drizzle-orm";

const router = Router();

// GET /api/slots/:storeSlug
router.get("/:storeSlug", async (req, res) => {
  try {
    const { storeSlug } = req.params;

    const [store] = await db
      .select({ id: storesTable.id })
      .from(storesTable)
      .where(eq(storesTable.slug, storeSlug))
      .limit(1);

    if (!store) {
      res.status(404).json({ error: "NotFound", message: "Store not found" });
      return;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const slots = await db
      .select()
      .from(pickupSlotsTable)
      .where(
        and(
          eq(pickupSlotsTable.storeId, store.id),
          gte(pickupSlotsTable.slotDate, today.toISOString().split("T")[0]),
          eq(pickupSlotsTable.isActive, true)
        )
      )
      .orderBy(pickupSlotsTable.slotDate, pickupSlotsTable.startTime);

    const formattedSlots = slots.map((slot) => ({
      id: slot.id,
      date: slot.slotDate,
      startTime: slot.startTime,
      endTime: slot.endTime,
      maxCapacity: slot.maxCapacity,
      availableCapacity: Math.max(0, slot.maxCapacity - slot.bookedCount),
    }));

    res.json(formattedSlots);
  } catch (err) {
    req.log.error({ err }, "Get slots error");
    res.status(500).json({ error: "ServerError", message: "Failed to fetch slots" });
  }
});

export default router;
