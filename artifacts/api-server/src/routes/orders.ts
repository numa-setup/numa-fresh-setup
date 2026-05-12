import { Router } from "express";
import { db } from "@workspace/db";
import {
  ordersTable, orderItemsTable, orderStatusHistoryTable,
  storesTable, productsTable, usersTable, pickupSlotsTable, promoCodesTable
} from "@workspace/db/schema";
import { eq, and, desc, count, sql, inArray, lt } from "drizzle-orm";
import { authenticate, authorize, AuthRequest } from "../middlewares/authenticate.js";
import { generateOrderNumber } from "../lib/auth.js";
import { emitToStore, emitToAdmin } from "../socket/index.js";
import { createNotification } from "./notifications.js";
import { sendExpoPushNotification } from "../lib/expoPush.js";
import QRCode from "qrcode";

const router = Router();

async function buildOrderResponse(order: typeof ordersTable.$inferSelect) {
  const [items, store] = await Promise.all([
    db.select().from(orderItemsTable).where(eq(orderItemsTable.orderId, order.id)),
    db.select().from(storesTable).where(eq(storesTable.id, order.storeId)).limit(1).then(r => r[0]),
  ]);

  return { ...order, items, store };
}

// GET /api/orders - List customer orders
router.get("/", authenticate, async (req: AuthRequest, res) => {
  try {
    const { status, page = "1", limit = "20" } = req.query as Record<string, string>;
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(50, parseInt(limit) || 20);
    const offset = (pageNum - 1) * limitNum;

    const conditions: any[] = [eq(ordersTable.customerId, req.user!.userId)];
    if (status) conditions.push(eq(ordersTable.status, status as any));

    const [orders, totalResult] = await Promise.all([
      db.select().from(ordersTable).where(and(...conditions)).orderBy(desc(ordersTable.createdAt)).limit(limitNum).offset(offset),
      db.select({ count: count() }).from(ordersTable).where(and(...conditions)),
    ]);

    const storeIds = [...new Set(orders.map(o => o.storeId))];
    const stores = storeIds.length > 0
      ? await db.select().from(storesTable).where(inArray(storesTable.id, storeIds))
      : [];
    const storeMap = Object.fromEntries(stores.map(s => [s.id, s]));

    const orderIds = orders.map(o => o.id);
    const allItems = orderIds.length > 0
      ? await db.select().from(orderItemsTable).where(inArray(orderItemsTable.orderId, orderIds))
      : [];
    const itemsByOrder = allItems.reduce((acc, item) => {
      if (!acc[item.orderId]) acc[item.orderId] = [];
      acc[item.orderId].push(item);
      return acc;
    }, {} as Record<string, typeof allItems>);

    const ordersWithDetails = orders.map(o => ({
      ...o,
      items: itemsByOrder[o.id] || [],
      store: storeMap[o.storeId],
    }));

    const total = totalResult[0]?.count ?? 0;
    res.json({ orders: ordersWithDetails, total, page: pageNum, totalPages: Math.ceil(total / limitNum) });
  } catch (err) {
    req.log.error({ err }, "List orders error");
    res.status(500).json({ error: "ServerError", message: "Failed to fetch orders" });
  }
});

// POST /api/orders - Create order
router.post("/", authenticate, async (req: AuthRequest, res) => {
  try {
    const { storeId, orderType, addressId, pickupSlotId, items, promoCode, loyaltyPointsToUse = 0, tip = 0, specialInstructions, vehicleInfo } = req.body;

    if (!storeId || !orderType || !items || !Array.isArray(items) || items.length === 0) {
      res.status(400).json({ error: "ValidationError", message: "Missing required order fields" });
      return;
    }

    const [store] = await db.select().from(storesTable).where(eq(storesTable.id, storeId)).limit(1);
    if (!store) {
      res.status(404).json({ error: "NotFound", message: "Store not found" });
      return;
    }
    if (store.isActiveManual === false) {
      res.status(400).json({ error: "StoreNotAcceptingOrders", message: "This store is not currently accepting orders. Please try again later." });
      return;
    }

    // Fetch products and calculate subtotal
    const productIds = items.map((i: any) => i.productId);
    const products = await db.select().from(productsTable).where(inArray(productsTable.id, productIds));
    const productMap = Object.fromEntries(products.map(p => [p.id, p]));

    let subtotal = 0;
    const orderItemsData = items.map((item: any) => {
      const product = productMap[item.productId];
      if (!product) throw new Error(`Product ${item.productId} not found`);
      const totalPrice = product.price * item.quantity;
      subtotal += totalPrice;
      return {
        productId: item.productId,
        name: product.name,
        productType: product.productType,
        quantity: item.quantity,
        unit: product.unit,
        unitPrice: product.price,
        totalPrice,
        isFreshMeat: product.isFreshMeat,
        meatCutType: item.meatCutType || null,
        meatCutInstructions: item.meatCutInstructions || null,
        meatMarination: item.meatMarination || null,
        substitutionPref: item.substitutionPref || "NO_REPLACEMENT",
        // Round 10 / Fix #4 — generic per-item shopper note
        customerNote: item.customerNote || null,
      };
    });

    // Promo discount
    let promoDiscount = 0;
    let validatedPromoCode: string | null = null;
    let appliedPromoId: string | null = null;
    if (promoCode) {
      const [promo] = await db.select().from(promoCodesTable).where(and(eq(promoCodesTable.code, promoCode.toUpperCase()), eq(promoCodesTable.isActive, true))).limit(1);
      if (!promo) {
        res.status(400).json({ error: "BusinessError", message: "Invalid or expired promo code" });
        return;
      }
      if (promo.expiryDate && new Date() > promo.expiryDate) {
        res.status(400).json({ error: "BusinessError", message: "Promo code has expired" });
        return;
      }
      if (promo.maxUses !== null && promo.usedCount >= promo.maxUses) {
        res.status(400).json({ error: "BusinessError", message: "Promo code has reached its usage limit" });
        return;
      }
      if (subtotal < promo.minOrder) {
        res.status(400).json({ error: "BusinessError", message: `Minimum order of $${promo.minOrder.toFixed(2)} required for this promo code` });
        return;
      }
      validatedPromoCode = promo.code;
      appliedPromoId = promo.id;
      promoDiscount = promo.discountType === "PERCENTAGE"
        ? subtotal * (promo.discountValue / 100)
        : promo.discountValue;
    }

    const convenienceFee = orderType === "EXPRESS_PICKUP" || orderType === "CURBSIDE_PICKUP" ? store.convenienceFee : 0;
    const deliveryFee = orderType === "STORE_DELIVERY" ? (store.deliveryFee ?? 0) : 0;
    const curbsideFee = orderType === "CURBSIDE_PICKUP" ? (store.curbsideFee ?? 0) : 0;
    const loyaltyDiscount = loyaltyPointsToUse * 0.01;
    const discount = promoDiscount + loyaltyDiscount;
    const estimatedTotal = Math.max(0, subtotal + convenienceFee + deliveryFee + curbsideFee - discount + tip);

    const orderNumber = generateOrderNumber();

    const [order] = await db.insert(ordersTable).values({
      orderNumber,
      customerId: req.user!.userId,
      storeId,
      addressId: addressId || null,
      pickupSlotId: pickupSlotId || null,
      status: "PENDING",
      orderType,
      subtotal,
      convenienceFee,
      deliveryFee,
      curbsideFee,
      discount,
      tip,
      estimatedTotal,
      promoCode: validatedPromoCode,
      promoDiscount,
      loyaltyPointsUsed: loyaltyPointsToUse,
      loyaltyDiscount,
      paymentStatus: "pending",
      vehicleInfo: vehicleInfo || null,
      specialInstructions: specialInstructions || null,
    }).returning();

    // Insert order items
    if (orderItemsData.length > 0) {
      await db.insert(orderItemsTable).values(orderItemsData.map(item => ({ ...item, orderId: order.id })));
    }

    // Insert status history
    await db.insert(orderStatusHistoryTable).values({
      orderId: order.id,
      status: "PENDING",
      note: "Order placed",
      createdBy: req.user!.userId,
    });

    // Increment promo code usage count, guarded against exceeding maxUses under concurrency
    if (appliedPromoId) {
      await db
        .update(promoCodesTable)
        .set({ usedCount: sql`${promoCodesTable.usedCount} + 1` })
        .where(and(
          eq(promoCodesTable.id, appliedPromoId),
          sql`(${promoCodesTable.maxUses} IS NULL OR ${promoCodesTable.usedCount} < ${promoCodesTable.maxUses})`
        ));
    }

    // Earn loyalty points: 1 point per dollar spent
    const basePoints = Math.floor(estimatedTotal);

    // Bonus 200 points for first-ever order
    const previousOrdersResult = await db
      .select({ count: count() })
      .from(ordersTable)
      .where(and(eq(ordersTable.customerId, req.user!.userId), lt(ordersTable.id, order.id)));
    const isFirstOrder = (previousOrdersResult[0]?.count ?? 1) === 0;
    const bonusPoints = isFirstOrder ? 200 : 0;
    const totalPoints = basePoints + bonusPoints;

    if (totalPoints > 0) {
      await db
        .update(usersTable)
        .set({ loyaltyPoints: sql`${usersTable.loyaltyPoints} + ${totalPoints}` })
        .where(eq(usersTable.id, req.user!.userId));
    }

    const fullOrder = await buildOrderResponse(order);

    // Notify store portal (auto-joined to store:{storeId} room) and admin dashboard
    try {
      const orderPayload = {
        orderId: order.id,
        orderNumber: order.orderNumber,
        storeId: order.storeId,
        storeName: store.name,
        customerId: order.customerId,
        customerName: `${req.user!.email}`,
        orderType: order.orderType,
        estimatedTotal: order.estimatedTotal,
        itemCount: orderItemsData.length,
        createdAt: order.createdAt,
      };
      emitToStore(order.storeId, "new_order", orderPayload);
      emitToAdmin("new_order", orderPayload);

      // Notify store owner
      if (store.ownerId) {
        createNotification(
          store.ownerId,
          "NEW_ORDER",
          "New Order Received",
          `Order #${order.orderNumber} — $${order.estimatedTotal?.toFixed(2)} · ${orderItemsData.length} item${orderItemsData.length !== 1 ? "s" : ""}`,
          { orderId: order.id, orderNumber: order.orderNumber },
          order.id
        ).catch(() => {});
      }

      // Notify customer (confirmation)
      createNotification(
        order.customerId,
        "ORDER_PLACED",
        "Order Placed Successfully",
        `Your order #${order.orderNumber} has been placed. We'll notify you when it's confirmed.`,
        { orderId: order.id, orderNumber: order.orderNumber },
        order.id
      ).catch(() => {});
    } catch (emitErr) {
      req.log.error({ err: emitErr, orderId: order.id }, "Failed to emit new_order socket event");
    }

    res.status(201).json({ ...fullOrder, loyaltyPointsEarned: totalPoints, isFirstOrderBonus: isFirstOrder });
  } catch (err) {
    req.log.error({ err }, "Create order error");
    res.status(500).json({ error: "ServerError", message: "Failed to create order" });
  }
});

// GET /api/orders/:orderId
router.get("/:orderId", authenticate, async (req: AuthRequest, res) => {
  try {
    const [order] = await db.select().from(ordersTable)
      .where(and(eq(ordersTable.id, req.params.orderId), eq(ordersTable.customerId, req.user!.userId)))
      .limit(1);

    if (!order) {
      res.status(404).json({ error: "NotFound", message: "Order not found" });
      return;
    }

    const fullOrder = await buildOrderResponse(order);
    res.json(fullOrder);
  } catch (err) {
    req.log.error({ err }, "Get order error");
    res.status(500).json({ error: "ServerError", message: "Failed to fetch order" });
  }
});

// POST /api/orders/:orderId/cancel
router.post("/:orderId/cancel", authenticate, async (req: AuthRequest, res) => {
  try {
    const { reason } = req.body;
    const [order] = await db.select().from(ordersTable)
      .where(and(eq(ordersTable.id, req.params.orderId), eq(ordersTable.customerId, req.user!.userId)))
      .limit(1);

    if (!order) {
      res.status(404).json({ error: "NotFound", message: "Order not found" });
      return;
    }

    if (!["PENDING", "STORE_CONFIRMED"].includes(order.status)) {
      res.status(400).json({ error: "BusinessError", message: "Order cannot be cancelled at this stage" });
      return;
    }

    const updatedRows = await db.update(ordersTable)
      .set({ status: "CANCELLED", cancelReason: reason })
      .where(and(eq(ordersTable.id, order.id), sql`${ordersTable.status} <> 'CANCELLED'`))
      .returning();

    let updated = updatedRows[0];
    if (updatedRows.length > 0) {
      if (order.promoCode) {
        const [promo] = await db.select().from(promoCodesTable)
          .where(eq(promoCodesTable.code, order.promoCode))
          .limit(1);
        if (promo) {
          await db.update(promoCodesTable)
            .set({ usedCount: sql`GREATEST(${promoCodesTable.usedCount} - 1, 0)` })
            .where(eq(promoCodesTable.id, promo.id));
        }
      }

      await db.insert(orderStatusHistoryTable).values({
        orderId: order.id,
        status: "CANCELLED",
        note: reason,
        createdBy: req.user!.userId,
      });

      // Notify customer their cancellation was processed
      createNotification(
        req.user!.userId,
        "ORDER_STATUS",
        "Order Cancelled",
        `Your order #${order.orderNumber} has been cancelled successfully.`,
        { orderId: order.id, orderNumber: order.orderNumber, status: "CANCELLED" },
        order.id
      ).catch(() => {});

      // Notify store owner about the customer cancellation
      db.select({ ownerId: storesTable.ownerId })
        .from(storesTable)
        .where(eq(storesTable.id, order.storeId))
        .limit(1)
        .then(([store]) => {
          if (store?.ownerId) {
            return createNotification(
              store.ownerId,
              "ORDER_STATUS",
              "Order Cancelled by Customer",
              `Order #${order.orderNumber} was cancelled by the customer.`,
              { orderId: order.id, orderNumber: order.orderNumber, status: "CANCELLED" },
              order.id
            );
          }
        })
        .catch(() => {});
    } else {
      const [latest] = await db.select().from(ordersTable).where(eq(ordersTable.id, order.id)).limit(1);
      updated = latest ?? order;
    }

    const fullOrder = await buildOrderResponse(updated);
    res.json(fullOrder);
  } catch (err) {
    req.log.error({ err }, "Cancel order error");
    res.status(500).json({ error: "ServerError", message: "Failed to cancel order" });
  }
});

// STORE PORTAL
// GET /api/store-portal/orders
router.get("/store-portal/list", authenticate, authorize("STORE_OWNER", "STORE_STAFF", "ADMIN"), async (req: AuthRequest, res) => {
  try {
    const { status, page = "1", limit = "50" } = req.query as Record<string, string>;
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, parseInt(limit) || 50);
    const offset = (pageNum - 1) * limitNum;

    const [store] = await db.select({ id: storesTable.id }).from(storesTable).where(eq(storesTable.ownerId, req.user!.userId)).limit(1);
    if (!store) {
      res.status(404).json({ error: "NotFound", message: "Store not found" });
      return;
    }

    const conditions: any[] = [eq(ordersTable.storeId, store.id)];
    if (status) conditions.push(eq(ordersTable.status, status as any));

    const [orders, totalResult] = await Promise.all([
      db.select().from(ordersTable).where(and(...conditions)).orderBy(desc(ordersTable.createdAt)).limit(limitNum).offset(offset),
      db.select({ count: count() }).from(ordersTable).where(and(...conditions)),
    ]);

    const orderIds = orders.map(o => o.id);
    const allItems = orderIds.length > 0
      ? await db.select().from(orderItemsTable).where(inArray(orderItemsTable.orderId, orderIds))
      : [];
    const itemsByOrder = allItems.reduce((acc, item) => {
      if (!acc[item.orderId]) acc[item.orderId] = [];
      acc[item.orderId].push(item);
      return acc;
    }, {} as Record<string, typeof allItems>);

    const [storeData] = await db.select().from(storesTable).where(eq(storesTable.id, store.id)).limit(1);

    const ordersWithDetails = orders.map(o => ({
      ...o,
      items: itemsByOrder[o.id] || [],
      store: storeData,
    }));

    const total = totalResult[0]?.count ?? 0;
    res.json({ orders: ordersWithDetails, total, page: pageNum, totalPages: Math.ceil(total / limitNum) });
  } catch (err) {
    req.log.error({ err }, "Store portal orders error");
    res.status(500).json({ error: "ServerError", message: "Failed to fetch store orders" });
  }
});

// PATCH /api/store-portal/orders/:orderId/status
router.patch("/store-portal/:orderId/status", authenticate, authorize("STORE_OWNER", "STORE_STAFF", "ADMIN"), async (req: AuthRequest, res) => {
  try {
    const { status, note, estimatedReadyAt } = req.body;
    const [store] = await db.select({ id: storesTable.id }).from(storesTable).where(eq(storesTable.ownerId, req.user!.userId)).limit(1);

    const [order] = await db.select().from(ordersTable)
      .where(and(eq(ordersTable.id, req.params.orderId), eq(ordersTable.storeId, store?.id || "")))
      .limit(1);

    if (!order) {
      res.status(404).json({ error: "NotFound", message: "Order not found" });
      return;
    }

    const updateData: Partial<typeof ordersTable.$inferInsert> = { status };
    if (estimatedReadyAt) updateData.estimatedReadyAt = new Date(estimatedReadyAt);
    if (status === "READY_FOR_PICKUP") {
      updateData.readyAt = new Date();
      const existingCode = order.pickupQrCode;
      if (!(existingCode && existingCode.startsWith("PKP-") && existingCode.length <= 15)) {
        updateData.pickupQrCode = generatePickupCode();
      }
    }
    if (status === "COMPLETED") updateData.completedAt = new Date();

    const isCancellation = status === "CANCELLED";
    const updateConditions = isCancellation
      ? and(eq(ordersTable.id, order.id), sql`${ordersTable.status} <> 'CANCELLED'`)
      : eq(ordersTable.id, order.id);

    const updatedRows = await db.update(ordersTable).set(updateData).where(updateConditions).returning();
    let updated = updatedRows[0];

    if (isCancellation) {
      if (updatedRows.length > 0) {
        if (order.promoCode) {
          const [promo] = await db.select().from(promoCodesTable)
            .where(eq(promoCodesTable.code, order.promoCode))
            .limit(1);
          if (promo) {
            await db.update(promoCodesTable)
              .set({ usedCount: sql`GREATEST(${promoCodesTable.usedCount} - 1, 0)` })
              .where(eq(promoCodesTable.id, promo.id));
          }
        }

        await db.insert(orderStatusHistoryTable).values({
          orderId: order.id,
          status,
          note: note || null,
          createdBy: req.user!.userId,
        });
      } else {
        const [latest] = await db.select().from(ordersTable).where(eq(ordersTable.id, order.id)).limit(1);
        updated = latest ?? order;
      }
    } else {
      await db.insert(orderStatusHistoryTable).values({
        orderId: order.id,
        status,
        note: note || null,
        createdBy: req.user!.userId,
      });
    }

    if (status === "READY_FOR_PICKUP" || status === "OUT_FOR_DELIVERY") {
      const pushMessages: Record<string, { title: string; body: string }> = {
        READY_FOR_PICKUP: {
          title: "Your order is ready!",
          body: `Order #${order.orderNumber} is ready for pickup. Come grab it!`,
        },
        OUT_FOR_DELIVERY: {
          title: "Your order is on the way!",
          body: `Order #${order.orderNumber} is out for delivery. Expect it soon!`,
        },
      };
      const pushMsg = pushMessages[status];
      if (pushMsg) {
        db.select({ expoPushToken: usersTable.expoPushToken })
          .from(usersTable)
          .where(eq(usersTable.id, order.customerId))
          .limit(1)
          .then(([customer]) => {
            if (customer?.expoPushToken) {
              return sendExpoPushNotification(
                customer.expoPushToken,
                pushMsg.title,
                pushMsg.body,
                { orderId: order.id, screen: "orders/" + order.id + "/track" },
              );
            }
          })
          .catch(() => {});
      }
    }

    const fullOrder = await buildOrderResponse(updated);
    res.json(fullOrder);
  } catch (err) {
    req.log.error({ err }, "Update order status error");
    res.status(500).json({ error: "ServerError", message: "Failed to update order status" });
  }
});

// POST /api/orders/:orderId/rate
router.post("/:orderId/rate", authenticate, authorize("CUSTOMER"), async (req: AuthRequest, res) => {
  try {
    const { rating, review } = req.body;
    if (!rating || rating < 1 || rating > 5) {
      res.status(400).json({ error: "ValidationError", message: "Rating must be between 1 and 5" });
      return;
    }
    const [order] = await db.select().from(ordersTable)
      .where(and(eq(ordersTable.id, req.params.orderId), eq(ordersTable.customerId, req.user!.userId)))
      .limit(1);
    if (!order) {
      res.status(404).json({ error: "NotFound", message: "Order not found" });
      return;
    }
    if (order.status !== "COMPLETED") {
      res.status(400).json({ error: "BusinessError", message: "Can only rate completed orders" });
      return;
    }
    res.json({ success: true, message: "Rating submitted successfully" });
  } catch (err) {
    req.log.error({ err }, "Rate order error");
    res.status(500).json({ error: "ServerError", message: "Failed to submit rating" });
  }
});

// POST /api/orders/:orderId/im-here
router.post("/:orderId/im-here", authenticate, authorize("CUSTOMER"), async (req: AuthRequest, res) => {
  try {
    const [order] = await db.select().from(ordersTable)
      .where(and(eq(ordersTable.id, req.params.orderId), eq(ordersTable.customerId, req.user!.userId)))
      .limit(1);
    if (!order) {
      res.status(404).json({ error: "NotFound", message: "Order not found" });
      return;
    }
    if (order.orderType !== "CURBSIDE_PICKUP") {
      res.status(400).json({ error: "BusinessError", message: "Only curbside orders support im-here" });
      return;
    }
    res.json({ success: true, message: "Store notified you have arrived" });
  } catch (err) {
    req.log.error({ err }, "Im-here error");
    res.status(500).json({ error: "ServerError", message: "Failed to notify store" });
  }
});

// POST /api/promo/validate
router.post("/promo/validate", authenticate, async (req: AuthRequest, res) => {
  try {
    const { code, orderTotal } = req.body;
    const [promo] = await db.select().from(promoCodesTable)
      .where(and(eq(promoCodesTable.code, (code || "").toUpperCase()), eq(promoCodesTable.isActive, true)))
      .limit(1);

    if (!promo) {
      res.json({ valid: false, message: "Invalid or expired promo code" });
      return;
    }

    if (promo.expiryDate && new Date() > promo.expiryDate) {
      res.json({ valid: false, message: "Promo code has expired" });
      return;
    }

    if (promo.maxUses !== null && promo.usedCount >= promo.maxUses) {
      res.json({ valid: false, message: "Promo code has reached its usage limit" });
      return;
    }

    if (orderTotal < promo.minOrder) {
      res.json({ valid: false, message: `Minimum order of $${promo.minOrder.toFixed(2)} required` });
      return;
    }

    const discountAmount = promo.discountType === "PERCENTAGE"
      ? orderTotal * (promo.discountValue / 100)
      : promo.discountValue;

    res.json({
      valid: true,
      discountType: promo.discountType,
      discountValue: promo.discountValue,
      discountAmount: Math.round(discountAmount * 100) / 100,
      message: `Promo applied! You save $${discountAmount.toFixed(2)}`,
    });
  } catch (err) {
    req.log.error({ err }, "Validate promo error");
    res.status(500).json({ error: "ServerError", message: "Failed to validate promo code" });
  }
});

// ─── PICKUP CODE & QR ───────────────────────────────────────────────────────

/** Generates a human-readable 6-char pickup code, e.g. "PKP-A3Z7XQ" */
function generatePickupCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // No ambiguous chars (0/O, I/1)
  let code = "PKP-";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

/**
 * Ensures an order has a pickupCode stored in pickupQrCode field.
 * Returns the (possibly newly created) pickup code string.
 * Uses the existing pickupQrCode column — no migration needed.
 */
async function ensurePickupCode(orderId: string): Promise<string> {
  const [order] = await db.select({ pickupQrCode: ordersTable.pickupQrCode })
    .from(ordersTable).where(eq(ordersTable.id, orderId)).limit(1);

  // If pickupQrCode already holds a short PKP-XXXXX code, reuse it
  const existing = order?.pickupQrCode;
  if (existing && existing.startsWith("PKP-") && existing.length <= 15) {
    return existing;
  }

  const code = generatePickupCode();
  await db.update(ordersTable).set({ pickupQrCode: code, updatedAt: new Date() })
    .where(eq(ordersTable.id, orderId));
  return code;
}

// GET /api/orders/:orderId/qr-code
// Authenticated: customer (order owner) OR store owner of that order
router.get("/:orderId/qr-code", authenticate, async (req: AuthRequest, res) => {
  try {
    const { orderId } = req.params;
    const userId = req.user!.userId;
    const role = req.user!.role;

    // Fetch the order with full details
    const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, orderId)).limit(1);
    if (!order) {
      res.status(404).json({ error: "NotFound", message: "Order not found" });
      return;
    }

    // Permission check: must be the customer OR the store owner
    if (role !== "ADMIN") {
      if (order.customerId !== userId) {
        // Check if requesting user is the store owner
        const [store] = await db.select({ ownerId: storesTable.ownerId })
          .from(storesTable).where(eq(storesTable.id, order.storeId)).limit(1);
        if (!store || store.ownerId !== userId) {
          res.status(403).json({ error: "Forbidden", message: "Not authorized" });
          return;
        }
      }
    }

    // QR code is only meaningful when order is READY_FOR_PICKUP, COMPLETED, or was once READY
    const relevantStatuses = ["READY_FOR_PICKUP", "COMPLETED", "REFUNDED"];
    if (!relevantStatuses.includes(order.status)) {
      res.status(400).json({
        error: "OrderNotReady",
        message: "QR code is only available when the order is ready for pickup",
      });
      return;
    }

    // Ensure pickupCode exists
    const pickupCode = await ensurePickupCode(orderId);

    // Fetch related data
    const [store, customer, items] = await Promise.all([
      db.select().from(storesTable).where(eq(storesTable.id, order.storeId)).limit(1).then(r => r[0]),
      db.select({ firstName: usersTable.firstName, lastName: usersTable.lastName, phone: usersTable.phone })
        .from(usersTable).where(eq(usersTable.id, order.customerId)).limit(1).then(r => r[0]),
      db.select().from(orderItemsTable).where(eq(orderItemsTable.orderId, orderId)),
    ]);

    const generatedAt = new Date();
    const expiresAt = new Date(generatedAt.getTime() + 24 * 60 * 60 * 1000);

    // Build rich QR payload
    const qrPayload = {
      orderId: order.id,
      orderNumber: order.orderNumber,
      pickupCode,
      customerName: customer ? `${customer.firstName} ${customer.lastName}` : "Customer",
      customerPhone: customer?.phone || null,
      storeName: store?.name || "",
      storeAddress: store ? `${store.address || ""}, ${store.city || ""}`.trim().replace(/^,\s*/, "") : "",
      items: items.map(i => ({
        name: i.name,
        quantity: i.quantity,
        price: `$${Number(i.finalPrice ?? i.totalPrice ?? 0).toFixed(2)}`,
      })),
      totalAmount: `$${Number(order.finalTotal ?? order.estimatedTotal ?? 0).toFixed(2)}`,
      status: order.status,
      generatedAt: generatedAt.toISOString(),
      expiresAt: expiresAt.toISOString(),
    };

    // Generate real QR code as base64 PNG
    const qrDataUrl = await QRCode.toDataURL(JSON.stringify(qrPayload), {
      width: 300,
      margin: 2,
      color: { dark: "#1a1a1a", light: "#ffffff" },
      errorCorrectionLevel: "H",
    });

    res.json({
      qrCode: qrDataUrl,        // base64 PNG data URL
      pickupCode,
      orderNumber: order.orderNumber,
      storeName: store?.name || "",
      customerName: qrPayload.customerName,
      totalAmount: qrPayload.totalAmount,
      status: order.status,
      generatedAt: generatedAt.toISOString(),
      expiresAt: expiresAt.toISOString(),
      isExpired: false,
    });
  } catch (err) {
    (req as any).log?.error({ err }, "QR code generation error");
    res.status(500).json({ error: "ServerError", message: "Failed to generate QR code" });
  }
});

// GET /api/orders/verify/:orderId  — PUBLIC route (no auth required)
// Store owner scans QR with phone → browser shows order details
router.get("/verify/:orderId", async (req, res) => {
  try {
    const { orderId } = req.params;

    const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, orderId)).limit(1);
    if (!order) {
      res.status(404).send(`<!DOCTYPE html><html><body style="font-family:sans-serif;padding:2rem;text-align:center">
        <h2>❌ Order Not Found</h2><p>This QR code is invalid or expired.</p></body></html>`);
      return;
    }

    const [store, customer, items] = await Promise.all([
      db.select({ name: storesTable.name, address: storesTable.address, city: storesTable.city })
        .from(storesTable).where(eq(storesTable.id, order.storeId)).limit(1).then(r => r[0]),
      db.select({ firstName: usersTable.firstName, lastName: usersTable.lastName, phone: usersTable.phone })
        .from(usersTable).where(eq(usersTable.id, order.customerId)).limit(1).then(r => r[0]),
      db.select({ name: orderItemsTable.name, quantity: orderItemsTable.quantity, totalPrice: orderItemsTable.totalPrice, finalPrice: orderItemsTable.finalPrice })
        .from(orderItemsTable).where(eq(orderItemsTable.orderId, orderId)),
    ]);

    const statusColor: Record<string, string> = {
      READY_FOR_PICKUP: "#16a34a",
      COMPLETED: "#64748b",
      CANCELLED: "#dc2626",
    };
    const statusLabel: Record<string, string> = {
      READY_FOR_PICKUP: "✅ Ready for Pickup",
      COMPLETED: "✔ Picked Up",
      CANCELLED: "❌ Cancelled",
    };

    const color = statusColor[order.status] || "#0891b2";
    const label = statusLabel[order.status] || order.status.replace(/_/g, " ");
    const total = Number(order.finalTotal ?? order.estimatedTotal ?? 0).toFixed(2);
    const itemsHtml = items.map(i =>
      `<tr><td style="padding:6px 0">${i.name}</td><td style="text-align:center">${i.quantity}</td><td style="text-align:right">$${Number(i.finalPrice ?? i.totalPrice ?? 0).toFixed(2)}</td></tr>`
    ).join("");

    res.setHeader("Content-Type", "text/html");
    res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Order Verification — #${order.orderNumber}</title>
  <style>
    body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;margin:0;padding:16px;background:#f8fafc;color:#1e293b}
    .card{background:#fff;border-radius:16px;padding:20px;margin-bottom:16px;box-shadow:0 1px 8px rgba(0,0,0,.08)}
    .badge{display:inline-block;padding:6px 14px;border-radius:100px;font-weight:700;font-size:0.9rem;color:#fff}
    .pickup-code{font-size:2rem;font-weight:800;letter-spacing:3px;color:#0891b2;text-align:center;padding:12px;border:2px dashed #bae6fd;border-radius:12px;background:#f0f9ff}
    table{width:100%;border-collapse:collapse}
    th{text-align:left;padding:6px 0;font-size:0.75rem;text-transform:uppercase;letter-spacing:.05em;color:#64748b;border-bottom:1px solid #e2e8f0}
    td{border-bottom:1px solid #f1f5f9;font-size:0.9rem}
    .total{font-size:1.1rem;font-weight:700;color:#0f172a}
    h1{font-size:1.25rem;font-weight:800;margin:0 0 4px}
    p{margin:4px 0;color:#64748b;font-size:0.875rem}
  </style>
</head>
<body>
  <div class="card">
    <span class="badge" style="background:${color}">${label}</span>
    <h1 style="margin-top:12px">Order #${order.orderNumber}</h1>
    <p>📍 ${store?.name || "Store"}</p>
    <p>👤 ${customer ? `${customer.firstName} ${customer.lastName}` : "Customer"}${customer?.phone ? ` · ${customer.phone}` : ""}</p>
  </div>

  ${(order.pickupQrCode && order.pickupQrCode.startsWith("PKP-")) ? `<div class="card">
    <p style="font-size:0.75rem;text-transform:uppercase;letter-spacing:.05em;color:#64748b;margin-bottom:8px">Pickup Code</p>
    <div class="pickup-code">${order.pickupQrCode}</div>
  </div>` : ""}

  <div class="card">
    <table>
      <thead><tr><th>Item</th><th style="text-align:center">Qty</th><th style="text-align:right">Price</th></tr></thead>
      <tbody>${itemsHtml}</tbody>
    </table>
    <div style="display:flex;justify-content:space-between;padding-top:12px;margin-top:8px;border-top:2px solid #e2e8f0">
      <span class="total">Total</span>
      <span class="total">$${total}</span>
    </div>
  </div>

  <p style="text-align:center;font-size:0.75rem;color:#94a3b8;margin-top:24px">Numa Fresh · Order Verification</p>
</body>
</html>`);
  } catch (err) {
    res.status(500).send(`<!DOCTYPE html><html><body style="font-family:sans-serif;padding:2rem;text-align:center">
      <h2>⚠️ Verification Error</h2><p>Could not load order details.</p></body></html>`);
  }
});

// POST /api/orders/:id/reorder - Re-add previous order items to cart info
router.post("/:id/reorder", authenticate, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const [order] = await db.select().from(ordersTable).where(and(eq(ordersTable.id, id), eq(ordersTable.customerId, req.user!.userId))).limit(1);
    if (!order) {
      res.status(404).json({ error: "NotFound", message: "Order not found" });
      return;
    }

    const [store] = await db.select().from(storesTable).where(eq(storesTable.id, order.storeId)).limit(1);
    const items = await db.select().from(orderItemsTable).where(eq(orderItemsTable.orderId, id));

    const productIds = items.map(i => i.productId).filter(Boolean);
    const products = productIds.length > 0
      ? await db.select().from(productsTable).where(and(inArray(productsTable.id, productIds as string[]), eq(productsTable.isActive, true)))
      : [];
    const productMap = Object.fromEntries(products.map(p => [p.id, p]));

    const reorderItems = items
      .filter(i => i.productId && productMap[i.productId])
      .map(i => ({
        product: productMap[i.productId!],
        quantity: i.quantity,
        name: i.name,
      }));

    res.json({
      items: reorderItems,
      storeId: store?.id || order.storeId,
      storeSlug: store?.slug || '',
      storeName: store?.name || '',
      unavailableCount: items.length - reorderItems.length,
    });
  } catch (err) {
    req.log.error({ err }, "Reorder error");
    res.status(500).json({ error: "ServerError", message: "Failed to prepare reorder" });
  }
});

export default router;
