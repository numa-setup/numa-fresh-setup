import { Router } from "express";
import { db } from "@workspace/db";
import { storesTable, categoriesTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { authenticate, authorize, AuthRequest } from "../middlewares/authenticate.js";
import { emitNewStoreApplication } from "../socket/index.js";

const router = Router();
router.use(authenticate);
router.use(authorize("STORE_OWNER", "ADMIN"));

async function getOwnerStore(userId: string) {
  const [store] = await db.select().from(storesTable).where(eq(storesTable.ownerId, userId)).limit(1);
  return store;
}

// GET /api/store/onboarding/status — check current onboarding progress
router.get("/status", async (req: AuthRequest, res) => {
  try {
    const store = await getOwnerStore(req.user!.userId);
    if (!store) { res.json({ hasStore: false, onboardingCompleted: false }); return; }
    res.json({
      hasStore: true,
      storeId: store.id,
      onboardingCompleted: store.onboardingCompleted,
      storeStatus: store.storeStatus,
      store,
    });
  } catch (err: any) {
    res.status(500).json({ error: "ServerError", message: err.message });
  }
});

// PATCH /api/store/onboarding/step/:step — save individual step data
router.patch("/step/:step", async (req: AuthRequest, res) => {
  try {
    const store = await getOwnerStore(req.user!.userId);
    if (!store) { res.status(404).json({ error: "NoStore", message: "No store found" }); return; }

    const step = parseInt(req.params.step);
    const data = req.body;
    let updateData: Record<string, unknown> = { updatedAt: new Date() };

    switch (step) {
      case 1: // Basic info
        if (data.name !== undefined) updateData.name = data.name;
        if (data.branchName !== undefined) updateData.branchName = data.branchName;
        if (data.tagline !== undefined) updateData.tagline = data.tagline;
        if (data.description !== undefined) updateData.description = data.description;
        if (data.phone !== undefined) updateData.phone = data.phone;
        if (data.email !== undefined) updateData.email = data.email;
        break;
      case 2: // Visuals
        if (data.logo !== undefined) updateData.logo = data.logo;
        if (data.banner !== undefined) updateData.banner = data.banner;
        if (data.cardImage !== undefined) updateData.cardImage = data.cardImage;
        break;
      case 3: // Location
        if (data.address !== undefined) updateData.address = data.address;
        if (data.city !== undefined) updateData.city = data.city;
        if (data.province !== undefined) updateData.province = data.province;
        if (data.postalCode !== undefined) updateData.postalCode = data.postalCode;
        if (data.lat !== undefined) updateData.lat = data.lat;
        if (data.lng !== undefined) updateData.lng = data.lng;
        if (data.googleMapsLink !== undefined) updateData.googleMapsLink = data.googleMapsLink;
        break;
      case 4: // Opening hours
        if (data.openingHoursJson !== undefined) updateData.openingHoursJson = data.openingHoursJson;
        break;
      case 5: // Services & amenities
        if (data.servicesOffered !== undefined) updateData.servicesOffered = data.servicesOffered;
        if (data.amenityTags !== undefined) updateData.amenityTags = data.amenityTags;
        if (data.minOrderAmount !== undefined) updateData.minOrderAmount = data.minOrderAmount;
        if (data.convenienceFee !== undefined) updateData.convenienceFee = data.convenienceFee;
        if (data.avgPrepTimeMinutes !== undefined) updateData.avgPrepTimeMinutes = data.avgPrepTimeMinutes;
        if (data.pickupAvailable !== undefined) updateData.pickupAvailable = data.pickupAvailable;
        if (data.curbsideAvailable !== undefined) updateData.curbsideAvailable = data.curbsideAvailable;
        if (data.deliveryAvailable !== undefined) updateData.deliveryAvailable = data.deliveryAvailable;
        break;
      case 6: // Halal Certification
        if (data.isHalalCertified !== undefined) updateData.isHalalCertified = data.isHalalCertified;
        if (data.halalCertNumber !== undefined) updateData.halalCertNumber = data.halalCertNumber;
        if (data.halalCertBody !== undefined) updateData.halalCertBody = data.halalCertBody;
        if (data.halalCertExpiry !== undefined) updateData.halalCertExpiry = data.halalCertExpiry ? new Date(data.halalCertExpiry) : null;
        break;
      case 8: // Featured Section
        if (data.premiumFreshEnabled !== undefined) updateData.premiumFreshEnabled = data.premiumFreshEnabled;
        if (data.premiumFreshBadgeTitle !== undefined) updateData.premiumFreshBadgeTitle = data.premiumFreshBadgeTitle;
        if (data.premiumFreshHeading !== undefined) updateData.premiumFreshHeading = data.premiumFreshHeading;
        if (data.premiumFreshDesc !== undefined) updateData.premiumFreshDesc = data.premiumFreshDesc;
        if (data.premiumFreshCutTags !== undefined) updateData.premiumFreshCutTags = data.premiumFreshCutTags;
        if (data.premiumFreshBullet1 !== undefined) updateData.premiumFreshBullet1 = data.premiumFreshBullet1;
        if (data.premiumFreshBullet2 !== undefined) updateData.premiumFreshBullet2 = data.premiumFreshBullet2;
        if (data.premiumFreshBullet3 !== undefined) updateData.premiumFreshBullet3 = data.premiumFreshBullet3;
        if (data.premiumFreshImages !== undefined) updateData.premiumFreshImages = data.premiumFreshImages;
        break;
      case 7: // Categories
        if (data.categories && Array.isArray(data.categories)) {
          // Normalize: accept either string[] (e.g. ["Meat & Poultry"]) or
          // object[] (e.g. [{ name, sortOrder }]). The onboarding wizard sends
          // strings; admin/edit flows may send objects. Drop empty/invalid entries.
          const normalized = (data.categories as Array<unknown>)
            .map((c, i) => {
              const name = typeof c === "string" ? c : (c as { name?: unknown })?.name;
              const sortOrder = typeof c === "object" && c !== null
                ? (c as { sortOrder?: number }).sortOrder ?? i
                : i;
              return typeof name === "string" && name.trim().length > 0
                ? { name: name.trim(), sortOrder }
                : null;
            })
            .filter((x): x is { name: string; sortOrder: number } => x !== null);

          await db.delete(categoriesTable).where(eq(categoriesTable.storeId, store.id));
          if (normalized.length > 0) {
            await db.insert(categoriesTable).values(
              normalized.map((c) => ({
                storeId: store.id,
                name: c.name,
                slug: c.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
                sortOrder: c.sortOrder,
                isActive: true,
              }))
            ).onConflictDoNothing();
          }
        }
        break;
    }

    const [updated] = await db.update(storesTable).set(updateData).where(eq(storesTable.id, store.id)).returning();
    res.json({ success: true, store: updated });
  } catch (err: any) {
    res.status(500).json({ error: "ServerError", message: err.message });
  }
});

// POST /api/store/onboarding/submit — final submission
router.post("/submit", async (req: AuthRequest, res) => {
  try {
    const store = await getOwnerStore(req.user!.userId);
    if (!store) { res.status(404).json({ error: "NoStore" }); return; }

    // Issue 2: enforce one-store-per-account state machine on the server so
    // the wizard can't be re-submitted (or replayed via a direct API call)
    // once an application is already in flight, approved, or suspended.
    // Only `draft` (initial) and `declined` (admin asked for changes) may
    // transition to `pending`.
    if (store.storeStatus === "pending") {
      res.status(409).json({ error: "AlreadySubmitted", message: "Your application is already submitted and waiting for admin review." });
      return;
    }
    if (store.storeStatus === "approved") {
      res.status(409).json({ error: "AlreadyApproved", message: "Your store is already approved. Edit your details from Settings instead." });
      return;
    }
    if (store.storeStatus === "suspended") {
      res.status(403).json({ error: "Suspended", message: "Your store is suspended. Please contact support." });
      return;
    }

    const [updated] = await db.update(storesTable)
      .set({
        onboardingCompleted: true,
        storeStatus: "pending",
        updatedAt: new Date(),
      })
      .where(eq(storesTable.id, store.id))
      .returning();

    // Notify admin
    emitNewStoreApplication(store.id, store.name, `${req.user!.email}`);

    res.json({ success: true, store: updated });
  } catch (err: any) {
    res.status(500).json({ error: "ServerError", message: err.message });
  }
});

// GET /api/store/settings — all store settings
router.get("/settings", async (req: AuthRequest, res) => {
  try {
    const store = await getOwnerStore(req.user!.userId);
    if (!store) { res.status(404).json({ error: "NoStore" }); return; }
    const categories = await db.select().from(categoriesTable).where(eq(categoriesTable.storeId, store.id));
    res.json({ ...store, categories });
  } catch (err: any) {
    res.status(500).json({ error: "ServerError", message: err.message });
  }
});

// Generic PATCH for any settings section
router.patch("/settings/:section", async (req: AuthRequest, res) => {
  try {
    const store = await getOwnerStore(req.user!.userId);
    if (!store) { res.status(404).json({ error: "NoStore" }); return; }

    const allowed = [
      "name", "branchName", "tagline", "description", "phone", "email",
      "logo", "banner", "cardImage",
      "address", "city", "province", "postalCode", "lat", "lng", "googleMapsLink",
      "openingHoursJson",
      "servicesOffered", "amenityTags", "minOrderAmount", "convenienceFee", "avgPrepTimeMinutes",
      "pickupAvailable", "curbsideAvailable", "deliveryAvailable",
      "premiumFreshEnabled", "premiumFreshBadgeTitle", "premiumFreshHeading", "premiumFreshDesc",
      "premiumFreshCutTags", "premiumFreshBullet1", "premiumFreshBullet2",
      "premiumFreshBullet3", "premiumFreshImages",
      "storeCategories",
    ];

    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    for (const key of allowed) {
      if (req.body[key] !== undefined) updateData[key] = req.body[key];
    }

    const [updated] = await db.update(storesTable).set(updateData).where(eq(storesTable.id, store.id)).returning();
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: "ServerError", message: err.message });
  }
});

// PATCH /api/store/toggle-active
router.patch("/toggle-active", async (req: AuthRequest, res) => {
  try {
    const store = await getOwnerStore(req.user!.userId);
    if (!store) { res.status(404).json({ error: "NoStore" }); return; }

    const newValue = req.body.isActive ?? !store.isActiveManual;
    const [updated] = await db.update(storesTable)
      .set({ isActiveManual: newValue, updatedAt: new Date() })
      .where(eq(storesTable.id, store.id))
      .returning();

    const { emitStoreAvailabilityChanged } = await import("../socket/index.js");
    emitStoreAvailabilityChanged(store.id, newValue, store.isCurrentlyOpen);

    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: "ServerError", message: err.message });
  }
});

// PATCH /api/store/toggle-visibility
router.patch("/toggle-visibility", async (req: AuthRequest, res) => {
  try {
    const store = await getOwnerStore(req.user!.userId);
    if (!store) { res.status(404).json({ error: "NoStore" }); return; }

    const newValue = req.body.visible ?? !store.showOnWebsite;
    const [updated] = await db.update(storesTable)
      .set({ showOnWebsite: newValue, updatedAt: new Date() })
      .where(eq(storesTable.id, store.id))
      .returning();

    const { emitStoreVisibilityChanged } = await import("../socket/index.js");
    emitStoreVisibilityChanged(store.id, newValue);

    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: "ServerError", message: err.message });
  }
});

export default router;
