import { Router } from "express";
import { db } from "@workspace/db";
import { storesTable } from "@workspace/db/schema";
import { and, eq } from "drizzle-orm";

const router = Router();

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLng = (lng2 - lng1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// GET /api/nearby-stores?lat=XX.XX&lng=XX.XX&radius=10
// radius in miles, defaults to 10
router.get("/nearby-stores", async (req, res) => {
  try {
    const lat = parseFloat(req.query["lat"] as string);
    const lng = parseFloat(req.query["lng"] as string);
    const radiusMiles = parseFloat(req.query["radius"] as string) || 10;

    if (isNaN(lat) || isNaN(lng)) {
      return res.status(400).json({ success: false, error: "lat and lng query params are required" });
    }

    const radiusKm = radiusMiles * 1.60934;

    const allStores = await db
      .select()
      .from(storesTable)
      .where(
        and(
          eq(storesTable.isActive, true),
          eq(storesTable.isApproved, true),
          eq(storesTable.showOnWebsite, true),
        ),
      );

    const nearby = allStores
      .filter((s) => s.lat && s.lng && haversineKm(lat, lng, s.lat, s.lng) <= radiusKm)
      .map((s) => {
        const distKm = haversineKm(lat, lng, s.lat!, s.lng!);
        const distMiles = Math.round(distKm * 0.621371 * 10) / 10;
        return {
          id: s.id,
          name: s.name,
          address: `${s.address}, ${s.city}`,
          distance: distMiles,
          isOpen: s.isCurrentlyOpen,
        };
      })
      .sort((a, b) => a.distance - b.distance);

    return res.json({ success: true, stores: nearby });
  } catch (err) {
    return res.status(500).json({ success: false, error: "Failed to fetch nearby stores" });
  }
});

export default router;
