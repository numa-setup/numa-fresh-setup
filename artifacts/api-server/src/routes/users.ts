import { Router } from "express";
import { db } from "@workspace/db";
import {
  usersTable, addressesTable, loyaltyTransactionsTable,
  ordersTable, orderItemsTable, reviewsTable,
} from "@workspace/db/schema";
import { eq, desc, sql } from "drizzle-orm";
import { authenticate, AuthRequest } from "../middlewares/authenticate.js";

const router = Router();

// GET /api/users/profile
router.get("/profile", authenticate, async (req: AuthRequest, res) => {
  try {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.user!.userId)).limit(1);
    if (!user) {
      res.status(404).json({ error: "NotFound", message: "User not found" });
      return;
    }
    const { passwordHash: _, ...safeUser } = user;
    res.json(safeUser);
  } catch (err) {
    req.log.error({ err }, "Get user profile error");
    res.status(500).json({ error: "ServerError", message: "Failed to fetch profile" });
  }
});

// PATCH /api/users/profile
router.patch("/profile", authenticate, async (req: AuthRequest, res) => {
  try {
    const { firstName, lastName, phone, preferredLanguage, expoPushToken } = req.body;
    const updatePayload: Partial<typeof usersTable.$inferInsert> = { updatedAt: new Date() };
    if (firstName !== undefined) updatePayload.firstName = firstName;
    if (lastName !== undefined) updatePayload.lastName = lastName;
    if (phone !== undefined) updatePayload.phone = phone;
    if (preferredLanguage !== undefined) updatePayload.preferredLanguage = preferredLanguage;
    if (expoPushToken !== undefined) updatePayload.expoPushToken = expoPushToken ?? null;

    const [updated] = await db.update(usersTable)
      .set(updatePayload)
      .where(eq(usersTable.id, req.user!.userId))
      .returning();

    const { passwordHash: _, ...safeUser } = updated;
    res.json(safeUser);
  } catch (err) {
    req.log.error({ err }, "Update profile error");
    res.status(500).json({ error: "ServerError", message: "Failed to update profile" });
  }
});

// GET /api/users/addresses
router.get("/addresses", authenticate, async (req: AuthRequest, res) => {
  try {
    const addresses = await db.select().from(addressesTable)
      .where(eq(addressesTable.userId, req.user!.userId))
      .orderBy(desc(addressesTable.isDefault), desc(addressesTable.createdAt));
    res.json(addresses);
  } catch (err) {
    req.log.error({ err }, "Get addresses error");
    res.status(500).json({ error: "ServerError", message: "Failed to fetch addresses" });
  }
});

// POST /api/users/addresses
router.post("/addresses", authenticate, async (req: AuthRequest, res) => {
  try {
    const { label, fullName, phone, line1, street, line2, city, province, postalCode, country, isDefault, instructions } = req.body;
    const resolvedLine1 = line1 || street;

    if (!resolvedLine1 || !city || !province || !postalCode) {
      res.status(400).json({ error: "ValidationError", message: "Street, city, state and ZIP code are required" });
      return;
    }

    if (isDefault) {
      await db.update(addressesTable).set({ isDefault: false }).where(eq(addressesTable.userId, req.user!.userId));
    }

    const [address] = await db.insert(addressesTable).values({
      userId: req.user!.userId,
      label: label || "Home",
      fullName: fullName || "",
      phone: phone || "",
      line1: resolvedLine1,
      line2: line2 || null,
      city,
      province,
      postalCode,
      country: country || "US",
      isDefault: Boolean(isDefault),
      instructions: instructions || null,
    }).returning();

    res.status(201).json(address);
  } catch (err) {
    req.log.error({ err }, "Create address error");
    res.status(500).json({ error: "ServerError", message: "Failed to create address" });
  }
});

// PATCH /api/users/addresses/:id
router.patch("/addresses/:id", authenticate, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { isDefault, label, line1, street, city, province, postalCode } = req.body;

    // Verify ownership
    const [existing] = await db.select().from(addressesTable)
      .where(eq(addressesTable.id, id)).limit(1);
    if (!existing || existing.userId !== req.user!.userId) {
      res.status(404).json({ error: "NotFound", message: "Address not found" });
      return;
    }

    if (isDefault) {
      await db.update(addressesTable).set({ isDefault: false }).where(eq(addressesTable.userId, req.user!.userId));
    }

    const updates: Record<string, any> = {};
    if (label !== undefined) updates.label = label;
    if (line1 !== undefined) updates.line1 = line1;
    if (street !== undefined) updates.line1 = street;
    if (city !== undefined) updates.city = city;
    if (province !== undefined) updates.province = province;
    if (postalCode !== undefined) updates.postalCode = postalCode;
    if (isDefault !== undefined) updates.isDefault = isDefault;

    const [updated] = await db.update(addressesTable).set(updates).where(eq(addressesTable.id, id)).returning();
    res.json(updated);
  } catch (err) {
    req.log.error({ err }, "Update address error");
    res.status(500).json({ error: "ServerError", message: "Failed to update address" });
  }
});

// DELETE /api/users/addresses/:id
router.delete("/addresses/:id", authenticate, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    const [existing] = await db.select().from(addressesTable)
      .where(eq(addressesTable.id, id)).limit(1);
    if (!existing || existing.userId !== req.user!.userId) {
      res.status(404).json({ error: "NotFound", message: "Address not found" });
      return;
    }

    await db.delete(addressesTable).where(eq(addressesTable.id, id));
    res.json({ message: "Address deleted" });
  } catch (err) {
    req.log.error({ err }, "Delete address error");
    res.status(500).json({ error: "ServerError", message: "Failed to delete address" });
  }
});

// GET /api/users/me/export — CCPA/privacy: export all personal data as JSON
router.get("/me/export", authenticate, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
    if (!user) { res.status(404).json({ error: "NotFound" }); return; }

    const addresses = await db.select().from(addressesTable).where(eq(addressesTable.userId, userId));
    const orders = await db.select().from(ordersTable).where(eq(ordersTable.customerId, userId)).orderBy(desc(ordersTable.createdAt));
    const transactions = await db.select().from(loyaltyTransactionsTable).where(eq(loyaltyTransactionsTable.userId, userId));
    const reviews = await db.select().from(reviewsTable).where(eq(reviewsTable.customerId, userId));

    const { passwordHash: _, googleId: __, ...safeUser } = user;
    const exportData = {
      exportedAt: new Date().toISOString(),
      requestedBy: safeUser.email,
      userData: safeUser,
      addresses,
      orders: orders.map(o => ({ ...o })),
      loyaltyTransactions: transactions,
      reviews,
    };

    res.setHeader("Content-Type", "application/json");
    res.setHeader("Content-Disposition", `attachment; filename="numa-fresh-data-export-${userId}.json"`);
    res.json(exportData);
  } catch (err) {
    req.log.error({ err }, "Data export error");
    res.status(500).json({ error: "ServerError", message: "Failed to export data" });
  }
});

// DELETE /api/users/me — CCPA/privacy: delete account and all personal data
router.delete("/me", authenticate, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
    if (!user) { res.status(404).json({ error: "NotFound" }); return; }

    // Soft-delete: deactivate and anonymize personal data
    await db.update(usersTable).set({
      isActive: false,
      email: `deleted-${userId}@deleted.numa`,
      firstName: "Deleted",
      lastName: "User",
      phone: null,
      avatar: null,
      passwordHash: null,
      googleId: null,
      updatedAt: new Date(),
    }).where(eq(usersTable.id, userId));

    res.json({ message: "Account deleted. Your personal data has been anonymized." });
  } catch (err) {
    req.log.error({ err }, "Account deletion error");
    res.status(500).json({ error: "ServerError", message: "Failed to delete account" });
  }
});

// POST /api/users/apply-referral
router.post("/apply-referral", authenticate, async (req: AuthRequest, res) => {
  try {
    const { referralCode } = req.body;
    if (!referralCode || typeof referralCode !== "string") {
      res.status(400).json({ error: "ValidationError", message: "referralCode is required" });
      return;
    }

    const upper = referralCode.trim().toUpperCase();
    if (!upper.startsWith("NUMA")) {
      res.status(400).json({ error: "InvalidCode", message: "Invalid referral code" });
      return;
    }

    const segment = upper.substring(4).toLowerCase();
    if (segment.length < 6) {
      res.status(400).json({ error: "InvalidCode", message: "Invalid referral code" });
      return;
    }

    const rows = await db.execute<{ id: string; loyalty_points: number }>(
      sql`SELECT id, loyalty_points FROM users WHERE REPLACE(id, '-', '') ILIKE ${segment + '%'} LIMIT 1`
    );
    const referrerRow = rows.rows?.[0];
    if (!referrerRow) {
      res.status(404).json({ error: "NotFound", message: "Referral code not found" });
      return;
    }
    const referrer = { id: referrerRow.id, loyaltyPoints: referrerRow.loyalty_points ?? 0 };

    if (referrer.id === req.user!.userId) {
      res.status(400).json({ error: "SelfReferral", message: "You cannot use your own referral code" });
      return;
    }

    const existingTx = await db.select({ id: loyaltyTransactionsTable.id })
      .from(loyaltyTransactionsTable)
      .where(eq(loyaltyTransactionsTable.userId, req.user!.userId))
      .limit(1);

    const alreadyHasTransactions = existingTx.length > 0;
    if (alreadyHasTransactions) {
      res.status(400).json({ error: "AlreadyUsed", message: "Referral code can only be used on a new account" });
      return;
    }

    const REFEREE_BONUS = 100;
    const REFERRER_BONUS = 50;

    await db.update(usersTable)
      .set({ loyaltyPoints: (referrer.loyaltyPoints || 0) + REFERRER_BONUS, updatedAt: new Date() })
      .where(eq(usersTable.id, referrerId));

    await db.insert(loyaltyTransactionsTable).values({
      userId: referrerId,
      type: "REFERRAL_BONUS",
      points: REFERRER_BONUS,
      description: `Referral bonus — friend joined using your code`,
    });

    await db.update(usersTable)
      .set({ loyaltyPoints: REFEREE_BONUS, updatedAt: new Date() })
      .where(eq(usersTable.id, req.user!.userId));

    await db.insert(loyaltyTransactionsTable).values({
      userId: req.user!.userId,
      type: "REFERRAL_BONUS",
      points: REFEREE_BONUS,
      description: `Welcome bonus — referral from ${upper}`,
    });

    res.json({ message: `Referral applied! You earned ${REFEREE_BONUS} points.`, pointsAwarded: REFEREE_BONUS });
  } catch (err) {
    req.log.error({ err }, "Apply referral error");
    res.status(500).json({ error: "ServerError", message: "Failed to apply referral code" });
  }
});

// GET /api/users/me/privacy-preferences — CCPA: get privacy opt-out preferences
router.get("/me/privacy-preferences", authenticate, async (req: AuthRequest, res) => {
  try {
    const [user] = await db.select({
      doNotSell: usersTable.doNotSell,
      limitSensitiveData: usersTable.limitSensitiveData,
    }).from(usersTable).where(eq(usersTable.id, req.user!.userId)).limit(1);
    if (!user) { res.status(404).json({ error: "NotFound" }); return; }
    res.json({ doNotSell: user.doNotSell, limitSensitiveData: user.limitSensitiveData });
  } catch (err) {
    req.log.error({ err }, "Get privacy prefs error");
    res.status(500).json({ error: "ServerError", message: "Failed to get privacy preferences" });
  }
});

// PATCH /api/users/me/privacy-preferences — CCPA/CPRA: update opt-out preferences
router.patch("/me/privacy-preferences", authenticate, async (req: AuthRequest, res) => {
  try {
    const { doNotSell, limitSensitiveData } = req.body;
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (typeof doNotSell === "boolean") updates.doNotSell = doNotSell;
    if (typeof limitSensitiveData === "boolean") updates.limitSensitiveData = limitSensitiveData;
    await db.update(usersTable).set(updates).where(eq(usersTable.id, req.user!.userId));
    res.json({ message: "Privacy preferences updated", doNotSell, limitSensitiveData });
  } catch (err) {
    req.log.error({ err }, "Update privacy prefs error");
    res.status(500).json({ error: "ServerError", message: "Failed to update privacy preferences" });
  }
});

// GET /api/users/loyalty
router.get("/loyalty", authenticate, async (req: AuthRequest, res) => {
  try {
    const [user] = await db.select({ loyaltyPoints: usersTable.loyaltyPoints }).from(usersTable).where(eq(usersTable.id, req.user!.userId)).limit(1);
    if (!user) {
      res.status(404).json({ error: "NotFound", message: "User not found" });
      return;
    }

    const transactions = await db.select().from(loyaltyTransactionsTable)
      .where(eq(loyaltyTransactionsTable.userId, req.user!.userId))
      .orderBy(desc(loyaltyTransactionsTable.createdAt))
      .limit(20);

    const points = user.loyaltyPoints;
    const pointsValue = points * 0.01;
    const tier = points >= 5000 ? "Gold" : points >= 1000 ? "Silver" : "Bronze";
    const nextTierPoints = tier === "Bronze" ? 1000 - points : tier === "Silver" ? 5000 - points : null;

    res.json({ points, pointsValue, tier, nextTierPoints, transactions });
  } catch (err) {
    req.log.error({ err }, "Get loyalty error");
    res.status(500).json({ error: "ServerError", message: "Failed to fetch loyalty info" });
  }
});

export default router;
