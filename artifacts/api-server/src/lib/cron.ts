import cron from "node-cron";
import { logger } from "./logger.js";
import { db } from "@workspace/db";
import {
  ordersTable, storesTable, usersTable, pickupSlotsTable,
  productsTable,
} from "@workspace/db/schema";
import { eq, and, lte, gte, lt, sql, desc, count } from "drizzle-orm";
import { sendEmail, weeklyEarningsSummaryEmail, loyaltyPointsExpiryEmail } from "./email.js";

// ── Pickup Slots Generator ────────────────────────────────────────────────────
// Runs daily at 1 AM — generates pickup slots for the next 7 days
cron.schedule("0 1 * * *", async () => {
  logger.info("CRON: pickup-slots starting");
  try {
    const stores = await db.select().from(storesTable).where(
      and(eq(storesTable.isActive, true), eq(storesTable.isApproved, true))
    );

    const now = new Date();
    const DAYS_AHEAD = 7;

    for (const store of stores) {
      const hours = store.openingHoursJson as Record<string, { open: string; close: string; closed?: boolean }>;
      const dayNames = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

      for (let d = 1; d <= DAYS_AHEAD; d++) {
        const date = new Date(now);
        date.setDate(now.getDate() + d);
        date.setHours(0, 0, 0, 0);

        const dayName = dayNames[date.getDay()];
        const dayHours = hours?.[dayName];
        if (!dayHours || dayHours.closed) continue;

        const existing = await db.select({ count: count() })
          .from(pickupSlotsTable)
          .where(and(
            eq(pickupSlotsTable.storeId, store.id),
            gte(pickupSlotsTable.date, date),
            lt(pickupSlotsTable.date, new Date(date.getTime() + 86400000)),
          ));
        if ((existing[0]?.count ?? 0) > 0) continue;

        const [openH, openM] = dayHours.open.split(":").map(Number);
        const [closeH, closeM] = dayHours.close.split(":").map(Number);
        const openMinutes = openH * 60 + (openM || 0);
        const closeMinutes = closeH * 60 + (closeM || 0);
        const slotDuration = store.slotDurationMinutes || 30;
        const maxOrders = store.maxOrdersPerSlot || 10;

        const slots = [];
        for (let start = openMinutes; start + slotDuration <= closeMinutes; start += slotDuration) {
          const startH = Math.floor(start / 60).toString().padStart(2, "0");
          const startMin = (start % 60).toString().padStart(2, "0");
          const endH = Math.floor((start + slotDuration) / 60).toString().padStart(2, "0");
          const endMin = ((start + slotDuration) % 60).toString().padStart(2, "0");
          slots.push({
            storeId: store.id,
            date,
            startTime: `${startH}:${startMin}`,
            endTime: `${endH}:${endMin}`,
            maxOrders,
            bookedOrders: 0,
            isAvailable: true,
          });
        }
        if (slots.length > 0) {
          await db.insert(pickupSlotsTable).values(slots).onConflictDoNothing();
        }
      }
    }
    logger.info({ stores: stores.length }, "CRON: pickup-slots complete");
  } catch (err) {
    logger.error({ err }, "CRON: pickup-slots failed");
  }
}, { timezone: "America/New_York" });

// ── Analytics Rollup ─────────────────────────────────────────────────────────
// Runs daily at 2 AM — aggregates yesterday's order data
cron.schedule("0 2 * * *", async () => {
  logger.info("CRON: analytics-rollup starting");
  try {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);
    const todayStart = new Date(yesterday.getTime() + 86400000);

    const stores = await db.select({ id: storesTable.id }).from(storesTable)
      .where(and(eq(storesTable.isActive, true), eq(storesTable.isApproved, true)));

    for (const store of stores) {
      const [result] = await db.select({
        totalOrders: count(),
        totalRevenue: sql<number>`COALESCE(SUM(CASE WHEN ${ordersTable.finalTotal} IS NOT NULL THEN ${ordersTable.finalTotal} ELSE ${ordersTable.estimatedTotal} END), 0)`,
      })
        .from(ordersTable)
        .where(and(
          eq(ordersTable.storeId, store.id),
          gte(ordersTable.createdAt, yesterday),
          lt(ordersTable.createdAt, todayStart),
          eq(ordersTable.status as any, "COMPLETED"),
        ));

      logger.info({ storeId: store.id, orders: result?.totalOrders, revenue: result?.totalRevenue }, "Analytics rollup");
    }
    logger.info("CRON: analytics-rollup complete");
  } catch (err) {
    logger.error({ err }, "CRON: analytics-rollup failed");
  }
}, { timezone: "America/New_York" });

// ── Weekly Payouts ────────────────────────────────────────────────────────────
// Runs every Monday at 9 AM
cron.schedule("0 9 * * 1", async () => {
  logger.info("CRON: weekly-payouts starting");
  try {
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    const stores = await db.select({
      id: storesTable.id,
      name: storesTable.name,
      email: storesTable.email,
      commissionRate: storesTable.commissionRate,
      stripeAccountId: storesTable.stripeAccountId,
    }).from(storesTable).where(and(eq(storesTable.isActive, true), eq(storesTable.isApproved, true)));

    const weekStart = weekAgo.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    const weekEnd = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" });

    for (const store of stores) {
      const [rev] = await db.select({
        totalOrders: count(),
        grossRevenue: sql<number>`COALESCE(SUM(CASE WHEN ${ordersTable.finalTotal} IS NOT NULL THEN ${ordersTable.finalTotal} ELSE ${ordersTable.estimatedTotal} END), 0)`,
      })
        .from(ordersTable)
        .where(and(
          eq(ordersTable.storeId, store.id),
          gte(ordersTable.createdAt, weekAgo),
          eq(ordersTable.status as any, "COMPLETED"),
        ));

      const gross = Number(rev?.grossRevenue || 0);
      const commission = gross * (store.commissionRate / 100);
      const net = gross - commission;

      if (net <= 0) continue;

      logger.info({ storeId: store.id, gross, commission, net }, "CRON: weekly payout calculation");

      await sendEmail(weeklyEarningsSummaryEmail({
        to: store.email,
        storeName: store.name,
        grossRevenue: gross,
        commission,
        netPayout: net,
        orderCount: rev?.totalOrders || 0,
        weekStart,
        weekEnd,
      }));
    }
    logger.info("CRON: weekly-payouts complete");
  } catch (err) {
    logger.error({ err }, "CRON: weekly-payouts failed");
  }
}, { timezone: "America/New_York" });

// ── Loyalty Points Expiry ─────────────────────────────────────────────────────
// Runs daily at midnight
cron.schedule("0 0 * * *", async () => {
  logger.info("CRON: loyalty-expiry starting");
  try {
    const sevenDaysFromNow = new Date();
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

    const usersWithPoints = await db.select({
      id: usersTable.id,
      email: usersTable.email,
      firstName: usersTable.firstName,
      loyaltyPoints: usersTable.loyaltyPoints,
    }).from(usersTable).where(
      and(eq(usersTable.isActive, true), gte(usersTable.loyaltyPoints as any, 100 as any))
    );

    for (const user of usersWithPoints) {
      logger.info({ userId: user.id, points: user.loyaltyPoints }, "Checking loyalty expiry for user");
    }
    logger.info({ usersChecked: usersWithPoints.length }, "CRON: loyalty-expiry complete");
  } catch (err) {
    logger.error({ err }, "CRON: loyalty-expiry failed");
  }
}, { timezone: "America/New_York" });

// ── Opening Hours Auto-Status ─────────────────────────────────────────────────
// Runs every minute — checks if stores should be open/closed based on hours
cron.schedule("* * * * *", async () => {
  try {
    const stores = await db.select({
      id: storesTable.id,
      openingHoursJson: storesTable.openingHoursJson,
      isCurrentlyOpen: storesTable.isCurrentlyOpen,
      isActiveManual: storesTable.isActiveManual,
    }).from(storesTable).where(
      and(eq(storesTable.isApproved, true), eq(storesTable.storeStatus as any, "approved") as any)
    );

    const now = new Date();
    const dayNames = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
    const dayName = dayNames[now.getDay()];
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    for (const store of stores) {
      if (!store.isActiveManual) {
        // Manually closed by owner — keep as closed
        if (store.isCurrentlyOpen) {
          await db.update(storesTable).set({ isCurrentlyOpen: false } as any).where(eq(storesTable.id, store.id));
          const { emitStoreAvailabilityChanged } = await import("../socket/index.js");
          emitStoreAvailabilityChanged(store.id, false, false);
        }
        continue;
      }

      const hours = store.openingHoursJson as Record<string, { open: string; close: string; closed?: boolean }> | null;
      if (!hours) continue;

      const dayHours = hours[dayName];
      let shouldBeOpen = false;

      if (dayHours && !dayHours.closed) {
        const [openH, openM] = dayHours.open?.split(":").map(Number) ?? [0, 0];
        const [closeH, closeM] = dayHours.close?.split(":").map(Number) ?? [0, 0];
        const openMinutes = (openH || 0) * 60 + (openM || 0);
        const closeMinutes = (closeH || 0) * 60 + (closeM || 0);
        shouldBeOpen = currentMinutes >= openMinutes && currentMinutes < closeMinutes;
      }

      if (shouldBeOpen !== store.isCurrentlyOpen) {
        await db.update(storesTable)
          .set({ isCurrentlyOpen: shouldBeOpen } as any)
          .where(eq(storesTable.id, store.id));
        const { emitStoreAvailabilityChanged } = await import("../socket/index.js");
        emitStoreAvailabilityChanged(store.id, store.isActiveManual, shouldBeOpen);
        logger.info({ storeId: store.id, shouldBeOpen }, "CRON: store open/close status updated");
      }
    }
  } catch (err) {
    logger.error({ err }, "CRON: opening-hours-check failed");
  }
});

logger.info("Cron jobs initialized: pickup-slots, analytics, weekly-payouts, loyalty-expiry, opening-hours");
