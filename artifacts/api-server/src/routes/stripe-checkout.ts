/**
 * Stripe checkout — standalone routes (Phase 2).
 *
 * POST /api/create-payment-intent — auth required; server recomputes totals from DB prices.
 * POST /api/confirm-order — auth required; verifies PaymentIntent succeeded, persists order.
 *
 * Webhook is mounted from app.ts with express.raw (see export stripeCheckoutWebhook).
 */
import { Router, type Request, type Response } from "express";
import { z } from "zod";
import Stripe from "stripe";
import { db } from "@workspace/db";
import {
  ordersTable, orderItemsTable, orderStatusHistoryTable,
  storesTable, productsTable, usersTable, promoCodesTable,
} from "@workspace/db/schema";
import { eq, and, count, sql, lt, inArray } from "drizzle-orm";
import { authenticate, type AuthRequest } from "../middlewares/authenticate.js";
import { generateOrderNumber } from "../lib/auth.js";
import { logger } from "../lib/logger.js";
import { emitToStore, emitToAdmin } from "../socket/index.js";
import { createNotification } from "./notifications.js";

const router = Router();

function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key?.trim()) return null;
  return new Stripe(key, { apiVersion: "2024-06-20" });
}

const orderBodySchema = z.object({
  storeId: z.string(),
  orderType: z.enum(["EXPRESS_PICKUP", "CURBSIDE_PICKUP", "STORE_DELIVERY"]),
  addressId: z.string().nullable().optional(),
  pickupSlotId: z.string().nullable().optional(),
  items: z.array(z.object({
    productId: z.string(),
    quantity: z.number(),
    meatCutType: z.string().nullable().optional(),
    meatCutInstructions: z.string().nullable().optional(),
    meatMarination: z.string().nullable().optional(),
    substitutionPref: z.string().optional(),
    customerNote: z.string().nullable().optional(),
  })).min(1),
  promoCode: z.string().nullable().optional(),
  loyaltyPointsToUse: z.number().optional().default(0),
  tip: z.number().optional().default(0),
  specialInstructions: z.string().nullable().optional(),
  vehicleInfo: z.unknown().nullable().optional(),
  deliveryMethod: z.enum(["home_delivery", "store_pickup"]).optional(),
  paymentMethod: z.enum(["online", "cod", "pay_at_store"]).optional(),
  deliveryAddress: z.object({
    street: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    zip: z.string().optional(),
  }).nullable().optional(),
  isFastDelivery: z.boolean().optional().default(false),
});

/** Maps casual checkout substitution keys to DB enum values. */
function normalizeSubstitutionPref(raw: string | undefined): "NO_REPLACEMENT" | "REPLACE_SIMILAR" | "CHOOSE_SPECIFIC" | "CONTACT_FIRST" {
  type Pref = "NO_REPLACEMENT" | "REPLACE_SIMILAR" | "CHOOSE_SPECIFIC" | "CONTACT_FIRST";
  const v = (raw || "").toLowerCase();
  const map: Record<string, Pref> = {
    none: "NO_REPLACEMENT",
    no_replacement: "NO_REPLACEMENT",
    similar: "REPLACE_SIMILAR",
    replace_similar: "REPLACE_SIMILAR",
    any: "REPLACE_SIMILAR",
    contact: "CONTACT_FIRST",
    contact_first: "CONTACT_FIRST",
    specific: "CHOOSE_SPECIFIC",
    choose_specific: "CHOOSE_SPECIFIC",
  };
  const mapped = map[v];
  if (mapped) return mapped;
  if (raw === "NO_REPLACEMENT" || raw === "REPLACE_SIMILAR" || raw === "CHOOSE_SPECIFIC" || raw === "CONTACT_FIRST") return raw as Pref;
  return "NO_REPLACEMENT";
}

type PricedOrder = {
  subtotal: number;
  convenienceFee: number;
  deliveryFee: number;
  curbsideFee: number;
  estimatedTotal: number;
  discount: number;
  promoDiscount: number;
  loyaltyDiscount: number;
  validatedPromoCode: string | null;
  appliedPromoId: string | null;
  itemsTotal: number;
  totalAmount: number;
  isFastDelivery: boolean;
  fastDeliveryCharge: number;
  orderItemsData: Array<{
    productId: string;
    name: string;
    productType: (typeof productsTable.$inferSelect)["productType"];
    quantity: number;
    unit: string;
    unitPrice: number;
    totalPrice: number;
    isFreshMeat: boolean;
    meatCutType: string | null;
    meatCutInstructions: string | null;
    meatMarination: string | null;
    substitutionPref: "NO_REPLACEMENT" | "REPLACE_SIMILAR" | "CHOOSE_SPECIFIC" | "CONTACT_FIRST";
    customerNote: string | null;
  }>;
  store: typeof storesTable.$inferSelect;
};

async function priceOrderFromDatabase(
  body: z.infer<typeof orderBodySchema>,
  _userId: string,
): Promise<{ priced: PricedOrder } | { error: string; status: number }> {
  const { storeId, orderType, items, promoCode, loyaltyPointsToUse = 0, tip = 0 } = body;
  const isFastDelivery = Boolean(body.isFastDelivery && body.deliveryMethod === "home_delivery");
  const configuredFastCharge = Number(process.env.FAST_DELIVERY_CHARGE ?? 0);
  const fastDeliveryCharge = isFastDelivery && Number.isFinite(configuredFastCharge) ? configuredFastCharge : 0;

  const [store] = await db.select().from(storesTable).where(eq(storesTable.id, storeId)).limit(1);
  if (!store) return { error: "Store not found", status: 404 };
  if (store.isActiveManual === false) {
    return { error: "This store is not currently accepting orders.", status: 400 };
  }

  const productIds = items.map((i) => i.productId);
  const products = await db.select().from(productsTable).where(inArray(productsTable.id, productIds));
  const productMap = Object.fromEntries(products.map((p) => [p.id, p]));

  let subtotal = 0;
  const orderItemsData: PricedOrder["orderItemsData"] = [];

  for (const item of items) {
    const product = productMap[item.productId];
    if (!product) return { error: `Product ${item.productId} not found`, status: 400 };
    const totalPrice = Number(product.price) * item.quantity;
    subtotal += totalPrice;
    orderItemsData.push({
      productId: item.productId,
      name: product.name,
      productType: product.productType,
      quantity: item.quantity,
      unit: product.unit,
      unitPrice: Number(product.price),
      totalPrice,
      isFreshMeat: product.isFreshMeat,
      meatCutType: item.meatCutType || null,
      meatCutInstructions: item.meatCutInstructions || null,
      meatMarination: item.meatMarination || null,
      substitutionPref: normalizeSubstitutionPref(item.substitutionPref),
      customerNote: item.customerNote || null,
    });
  }

  let promoDiscount = 0;
  let validatedPromoCode: string | null = null;
  let appliedPromoId: string | null = null;
  if (promoCode) {
    const [promo] = await db.select().from(promoCodesTable)
      .where(and(eq(promoCodesTable.code, promoCode.toUpperCase()), eq(promoCodesTable.isActive, true))).limit(1);
    if (!promo) return { error: "Invalid or expired promo code", status: 400 };
    if (promo.expiryDate && new Date() > promo.expiryDate) return { error: "Promo code has expired", status: 400 };
    if (promo.maxUses !== null && promo.usedCount >= promo.maxUses) {
      return { error: "Promo code has reached its usage limit", status: 400 };
    }
    if (subtotal < promo.minOrder) {
      return { error: `Minimum order of $${promo.minOrder.toFixed(2)} required for this promo code`, status: 400 };
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
  const estimatedTotal = Math.max(0, subtotal + convenienceFee + deliveryFee + curbsideFee + fastDeliveryCharge - discount + tip);

  return {
    priced: {
      subtotal,
      convenienceFee,
      deliveryFee,
      curbsideFee,
      estimatedTotal,
      discount,
      promoDiscount,
      loyaltyDiscount,
      itemsTotal: subtotal,
      totalAmount: estimatedTotal,
      isFastDelivery,
      fastDeliveryCharge,
      validatedPromoCode,
      appliedPromoId,
      orderItemsData,
      store,
    },
  };
}

async function insertOrderAfterSuccessfulPayment(
  req: AuthRequest,
  body: z.infer<typeof orderBodySchema>,
  priced: PricedOrder,
  paymentIntent: Stripe.PaymentIntent,
): Promise<Awaited<ReturnType<typeof buildOrderResponse>> & { loyaltyPointsEarned: number; isFirstOrderBonus: boolean }> {
  const userId = req.user!.userId;
  const {
    storeId, orderType, addressId, pickupSlotId, tip = 0,
    loyaltyPointsToUse = 0, specialInstructions, vehicleInfo, deliveryMethod, paymentMethod, deliveryAddress,
  } = body;

  const { store, orderItemsData, estimatedTotal, subtotal, convenienceFee, deliveryFee, curbsideFee,
    discount, promoDiscount, loyaltyDiscount, validatedPromoCode, appliedPromoId, fastDeliveryCharge, isFastDelivery } = priced;

  const [existing] = await db.select({ id: ordersTable.id }).from(ordersTable)
    .where(eq(ordersTable.paymentIntentId, paymentIntent.id)).limit(1);
  if (existing) {
    const [o] = await db.select().from(ordersTable).where(eq(ordersTable.id, existing.id)).limit(1);
    const existingFull = await buildOrderResponse(o!);
    return { ...existingFull, loyaltyPointsEarned: 0, isFirstOrderBonus: false };
  }

  const orderNumber = generateOrderNumber();
  const latestCharge = paymentIntent.latest_charge;
  const stripeChargeId = typeof latestCharge === "string" ? latestCharge : latestCharge && typeof latestCharge === "object" && "id" in latestCharge
    ? (latestCharge as { id: string }).id
    : null;

  const [order] = await db.insert(ordersTable).values({
    orderNumber,
    customerId: userId,
    storeId,
    addressId: addressId || null,
    pickupSlotId: pickupSlotId || null,
    status: "PENDING",
    orderType,
    deliveryMethod: deliveryMethod || (orderType === "STORE_DELIVERY" ? "home_delivery" : "store_pickup"),
    paymentMethod: paymentMethod || "online",
    subtotal,
    itemsTotal: subtotal,
    convenienceFee,
    deliveryFee,
    curbsideFee,
    discount,
    tip,
    estimatedTotal,
    totalAmount: estimatedTotal,
    finalTotal: estimatedTotal,
    promoCode: validatedPromoCode,
    promoDiscount,
    loyaltyPointsUsed: loyaltyPointsToUse,
    loyaltyDiscount,
    paymentIntentId: paymentIntent.id,
    stripePaymentIntentId: paymentIntent.id,
    paymentStatus: "paid",
    stripeChargeId: stripeChargeId || null,
    finalCaptured: true,
    vehicleInfo: vehicleInfo || null,
    deliveryAddress: deliveryAddress || null,
    isFastDelivery,
    fastDeliveryCharge,
    specialInstructions: specialInstructions || null,
  }).returning();

  if (orderItemsData.length > 0) {
    await db.insert(orderItemsTable).values(orderItemsData.map((item) => ({ ...item, orderId: order.id })));
  }

  await db.insert(orderStatusHistoryTable).values({
    orderId: order.id,
    status: "PENDING",
    note: "Order placed (Stripe)",
    createdBy: userId,
  });

  if (appliedPromoId) {
    await db
      .update(promoCodesTable)
      .set({ usedCount: sql`${promoCodesTable.usedCount} + 1` })
      .where(and(
        eq(promoCodesTable.id, appliedPromoId),
        sql`(${promoCodesTable.maxUses} IS NULL OR ${promoCodesTable.usedCount} < ${promoCodesTable.maxUses})`,
      ));
  }

  const basePoints = Math.floor(estimatedTotal);
  const previousOrdersResult = await db
    .select({ count: count() })
    .from(ordersTable)
    .where(and(eq(ordersTable.customerId, userId), lt(ordersTable.id, order.id)));
  const isFirstOrder = (previousOrdersResult[0]?.count ?? 1) === 0;
  const bonusPoints = isFirstOrder ? 200 : 0;
  const totalPoints = basePoints + bonusPoints;
  if (totalPoints > 0) {
    await db
      .update(usersTable)
      .set({ loyaltyPoints: sql`${usersTable.loyaltyPoints} + ${totalPoints}` })
      .where(eq(usersTable.id, userId));
  }

  const fullOrder = await buildOrderResponse(order);

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
    if (store.ownerId) {
      createNotification(
        store.ownerId,
        "NEW_ORDER",
        "New Order Received",
        `Order #${order.orderNumber} — $${order.estimatedTotal?.toFixed(2)} · ${orderItemsData.length} item${orderItemsData.length !== 1 ? "s" : ""}`,
        { orderId: order.id, orderNumber: order.orderNumber },
        order.id,
      ).catch(() => {});
    }
    createNotification(
      order.customerId,
      "ORDER_PLACED",
      "Order Placed Successfully",
      `Your order #${order.orderNumber} has been placed. We'll notify you when it's confirmed.`,
      { orderId: order.id, orderNumber: order.orderNumber },
      order.id,
    ).catch(() => {});
  } catch (emitErr) {
    logger.error({ err: emitErr, orderId: order.id }, "Stripe confirm-order emit failed");
  }

  return { ...fullOrder, loyaltyPointsEarned: totalPoints, isFirstOrderBonus: isFirstOrder };
}

async function buildOrderResponse(order: typeof ordersTable.$inferSelect) {
  const [items, store] = await Promise.all([
    db.select().from(orderItemsTable).where(eq(orderItemsTable.orderId, order.id)),
    db.select().from(storesTable).where(eq(storesTable.id, order.storeId)).limit(1).then((r) => r[0]),
  ]);
  return { ...order, items, store };
}

// POST /api/create-payment-intent
router.post("/create-payment-intent", authenticate, async (req: AuthRequest, res: Response) => {
  const stripe = getStripe();
  if (!stripe) {
    res.status(503).json({ error: "PaymentUnavailable", message: "Stripe is not configured (STRIPE_SECRET_KEY)." });
    return;
  }

  try {
    const parsed = orderBodySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "ValidationError", message: parsed.error.message });
      return;
    }

    const pricedResult = await priceOrderFromDatabase(parsed.data, req.user!.userId);
    if ("error" in pricedResult) {
      res.status(pricedResult.status).json({ error: "BusinessError", message: pricedResult.error });
      return;
    }
    const { estimatedTotal } = pricedResult.priced;
    const amountCents = Math.round(estimatedTotal * 100);
    if (amountCents < 50) {
      res.status(400).json({ error: "ValidationError", message: "Amount too small for card payment" });
      return;
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountCents,
      currency: "usd",
      automatic_payment_methods: { enabled: true },
      metadata: {
        userId: req.user!.userId,
        storeId: parsed.data.storeId,
        orderType: parsed.data.orderType,
      },
    });

    res.json({ clientSecret: paymentIntent.client_secret, paymentIntentId: paymentIntent.id, amount: estimatedTotal });
  } catch (err) {
    logger.error({ err }, "create-payment-intent failed");
    res.status(500).json({ error: "ServerError", message: "Failed to create payment intent" });
  }
});

const confirmSchema = orderBodySchema.extend({
  paymentIntentId: z.string(),
});

const checkoutPlaceSchema = z.object({
  storeId: z.string(),
  items: z.array(z.object({
    productId: z.string(),
    quantity: z.number(),
    meatCutType: z.string().nullable().optional(),
    meatCutInstructions: z.string().nullable().optional(),
    meatMarination: z.string().nullable().optional(),
    substitutionPref: z.string().optional(),
    customerNote: z.string().nullable().optional(),
  })).min(1),
  deliveryMethod: z.enum(["home_delivery", "store_pickup"]),
  paymentMethod: z.enum(["online", "cod", "pay_at_store"]),
  deliveryAddress: z.object({
    street: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    zip: z.string().optional(),
  }).nullable().optional(),
  isFastDelivery: z.boolean().optional().default(false),
  fastDeliveryCharge: z.number().optional(),
  stripePaymentIntentId: z.string().nullable().optional(),
  totalAmount: z.number().optional(),
  promoCode: z.string().nullable().optional(),
  loyaltyPointsToUse: z.number().optional().default(0),
  tip: z.number().optional().default(0),
  specialInstructions: z.string().nullable().optional(),
});

// POST /api/confirm-order
router.post("/confirm-order", authenticate, async (req: AuthRequest, res: Response) => {
  const stripe = getStripe();
  if (!stripe) {
    res.status(503).json({ error: "PaymentUnavailable", message: "Stripe is not configured." });
    return;
  }

  try {
    const parsed = confirmSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "ValidationError", message: parsed.error.message });
      return;
    }

    const { paymentIntentId, ...orderPayload } = parsed.data;
    const pi = await stripe.paymentIntents.retrieve(paymentIntentId);

    if (pi.metadata?.userId !== req.user!.userId) {
      res.status(403).json({ error: "Forbidden", message: "Payment does not belong to this account" });
      return;
    }

    if (pi.status !== "succeeded") {
      res.status(400).json({
        error: "PaymentNotComplete",
        message: `Payment status: ${pi.status}`,
        status: pi.status,
      });
      return;
    }

    const pricedResult = await priceOrderFromDatabase(orderPayload, req.user!.userId);
    if ("error" in pricedResult) {
      res.status(pricedResult.status).json({ error: "BusinessError", message: pricedResult.error });
      return;
    }

    const expectedCents = Math.round(pricedResult.priced.estimatedTotal * 100);
    if (Math.abs(expectedCents - pi.amount) > 1) {
      logger.warn({ expectedCents, actual: pi.amount, pi: pi.id }, "Stripe amount mismatch — refusing confirm");
      res.status(400).json({
        error: "AmountMismatch",
        message: "Order total changed or does not match payment. Please start checkout again.",
      });
      return;
    }

    const result = await insertOrderAfterSuccessfulPayment(req, orderPayload, pricedResult.priced, pi);
    res.status(201).json(result);
  } catch (err) {
    logger.error({ err }, "confirm-order failed");
    res.status(500).json({ error: "ServerError", message: "Failed to confirm order" });
  }
});

// POST /api/orders/create-payment-intent
router.post("/orders/create-payment-intent", authenticate, async (req: AuthRequest, res: Response) => {
  const stripe = getStripe();
  if (!stripe) {
    res.status(503).json({ error: "PaymentUnavailable", message: "Stripe is not configured (STRIPE_SECRET_KEY)." });
    return;
  }
  const parsed = checkoutPlaceSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "ValidationError", message: parsed.error.message });
    return;
  }
  if (parsed.data.paymentMethod !== "online") {
    res.status(400).json({ error: "ValidationError", message: "Payment method must be online for PaymentIntent creation." });
    return;
  }
  if (parsed.data.deliveryMethod === "home_delivery" && !parsed.data.deliveryAddress?.street) {
    res.status(400).json({ error: "ValidationError", message: "Delivery address is required for home delivery." });
    return;
  }
  try {
    const orderType: "STORE_DELIVERY" | "EXPRESS_PICKUP" =
      parsed.data.deliveryMethod === "home_delivery" ? "STORE_DELIVERY" : "EXPRESS_PICKUP";
    const pricedResult = await priceOrderFromDatabase({
      ...parsed.data,
      orderType,
      addressId: null,
      pickupSlotId: null,
      vehicleInfo: null,
    }, req.user!.userId);
    if ("error" in pricedResult) {
      res.status(pricedResult.status).json({ error: "BusinessError", message: pricedResult.error });
      return;
    }
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(pricedResult.priced.estimatedTotal * 100),
      currency: "usd",
      automatic_payment_methods: { enabled: true },
      metadata: {
        userId: req.user!.userId,
        storeId: parsed.data.storeId,
        deliveryMethod: parsed.data.deliveryMethod,
        isFastDelivery: String(Boolean(parsed.data.isFastDelivery)),
      },
    });
    res.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      amount: pricedResult.priced.estimatedTotal,
      isTestMode: (process.env.STRIPE_SECRET_KEY || "").trim().startsWith("sk_test_"),
    });
  } catch (err) {
    logger.error({ err }, "orders/create-payment-intent failed");
    res.status(500).json({ error: "ServerError", message: "Failed to create payment intent" });
  }
});

// POST /api/orders/place
router.post("/orders/place", authenticate, async (req: AuthRequest, res: Response) => {
  const parsed = checkoutPlaceSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "ValidationError", message: parsed.error.message });
    return;
  }
  try {
    if (parsed.data.deliveryMethod === "home_delivery" && parsed.data.paymentMethod === "pay_at_store") {
      res.status(400).json({ error: "ValidationError", message: "pay_at_store is only available for store pickup." });
      return;
    }
    if (parsed.data.deliveryMethod === "store_pickup" && parsed.data.paymentMethod === "cod") {
      res.status(400).json({ error: "ValidationError", message: "cod is only available for home delivery." });
      return;
    }
    if (parsed.data.deliveryMethod === "home_delivery" && !parsed.data.deliveryAddress?.street) {
      res.status(400).json({ error: "ValidationError", message: "Delivery address is required for home delivery." });
      return;
    }
    const orderType: "STORE_DELIVERY" | "EXPRESS_PICKUP" =
      parsed.data.deliveryMethod === "home_delivery" ? "STORE_DELIVERY" : "EXPRESS_PICKUP";
    const basePayload = {
      ...parsed.data,
      orderType,
      addressId: null,
      pickupSlotId: null,
      vehicleInfo: null,
    };
    const pricedResult = await priceOrderFromDatabase(basePayload, req.user!.userId);
    if ("error" in pricedResult) {
      res.status(pricedResult.status).json({ error: "BusinessError", message: pricedResult.error });
      return;
    }

    if (parsed.data.paymentMethod === "online") {
      const stripe = getStripe();
      if (!stripe) {
        res.status(503).json({ error: "PaymentUnavailable", message: "Stripe is not configured." });
        return;
      }
      if (!parsed.data.stripePaymentIntentId) {
        res.status(400).json({ error: "ValidationError", message: "stripePaymentIntentId is required for online payment" });
        return;
      }
      const pi = await stripe.paymentIntents.retrieve(parsed.data.stripePaymentIntentId);
      if (pi.metadata?.userId !== req.user!.userId) {
        res.status(403).json({ error: "Forbidden", message: "Payment does not belong to this account" });
        return;
      }
      if (pi.status !== "succeeded") {
        res.status(400).json({ error: "PaymentNotComplete", message: `Payment status: ${pi.status}` });
        return;
      }
      const expectedCents = Math.round(pricedResult.priced.estimatedTotal * 100);
      if (Math.abs(expectedCents - pi.amount) > 1) {
        res.status(400).json({ error: "AmountMismatch", message: "Order total changed. Please retry checkout." });
        return;
      }
      const result = await insertOrderAfterSuccessfulPayment(req, basePayload, pricedResult.priced, pi);
      res.status(201).json({ orderId: result.id, orderNumber: result.orderNumber, paymentStatus: "paid", order: result });
      return;
    }

    const [order] = await db.insert(ordersTable).values({
      orderNumber: generateOrderNumber(),
      customerId: req.user!.userId,
      storeId: parsed.data.storeId,
      status: "PENDING",
      orderType,
      deliveryMethod: parsed.data.deliveryMethod,
      paymentMethod: parsed.data.paymentMethod,
      paymentStatus: parsed.data.paymentMethod === "cod" ? "cod" : "pay_at_store",
      subtotal: pricedResult.priced.subtotal,
      itemsTotal: pricedResult.priced.itemsTotal,
      convenienceFee: pricedResult.priced.convenienceFee,
      deliveryFee: pricedResult.priced.deliveryFee,
      curbsideFee: pricedResult.priced.curbsideFee,
      discount: pricedResult.priced.discount,
      tip: parsed.data.tip,
      estimatedTotal: pricedResult.priced.estimatedTotal,
      totalAmount: pricedResult.priced.totalAmount,
      promoCode: pricedResult.priced.validatedPromoCode,
      promoDiscount: pricedResult.priced.promoDiscount,
      loyaltyPointsUsed: parsed.data.loyaltyPointsToUse,
      loyaltyDiscount: pricedResult.priced.loyaltyDiscount,
      deliveryAddress: parsed.data.deliveryAddress || null,
      isFastDelivery: pricedResult.priced.isFastDelivery,
      fastDeliveryCharge: pricedResult.priced.fastDeliveryCharge,
      specialInstructions: parsed.data.specialInstructions || null,
    }).returning();

    await db.insert(orderItemsTable).values(
      pricedResult.priced.orderItemsData.map((item) => ({ ...item, orderId: order.id })),
    );
    await db.insert(orderStatusHistoryTable).values({
      orderId: order.id,
      status: "PENDING",
      note: parsed.data.paymentMethod === "cod" ? "Order placed (Cash on Delivery)" : "Order placed (Pay at Store)",
      createdBy: req.user!.userId,
    });
    res.status(201).json({ orderId: order.id, orderNumber: order.orderNumber, paymentStatus: order.paymentStatus });
  } catch (err) {
    logger.error({ err }, "orders/place failed");
    res.status(500).json({ error: "ServerError", message: "Failed to place order" });
  }
});

/** Raw-body Stripe webhook (mounted in app.ts before express.json). */
export async function stripeCheckoutWebhook(req: Request, res: Response): Promise<void> {
  const stripe = getStripe();
  if (!stripe) {
    res.status(200).json({ received: true });
    return;
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const whsec = webhookSecret?.trim() || "";
  const skipVerification = !whsec || whsec === "whsec_test_placeholder";
  if (skipVerification) {
    logger.warn("Webhook verification skipped - test mode");
    if (!req.body || typeof req.body !== "object" || !("type" in req.body)) {
      res.status(200).json({ received: true });
      return;
    }
    const event = req.body as Stripe.Event;
    try {
      switch (event.type) {
        case "payment_intent.succeeded": {
          const pi = event.data.object as Stripe.PaymentIntent;
          await db.update(ordersTable).set({ paymentStatus: "paid", updatedAt: new Date() })
            .where(eq(ordersTable.stripePaymentIntentId, pi.id));
          break;
        }
        case "payment_intent.payment_failed": {
          const pi = event.data.object as Stripe.PaymentIntent;
          await db.update(ordersTable).set({ paymentStatus: "failed", updatedAt: new Date() })
            .where(eq(ordersTable.stripePaymentIntentId, pi.id));
          break;
        }
        default:
          break;
      }
    } catch (err) {
      logger.error({ err, type: event.type }, "stripe-checkout webhook test-mode handler error");
    }
    res.status(200).json({ received: true });
    return;
  }

  let event: Stripe.Event;
  try {
    const sig = req.headers["stripe-signature"] as string;
    const buf = req.body instanceof Buffer ? req.body : Buffer.from(JSON.stringify(req.body));
    event = stripe.webhooks.constructEvent(buf, sig, whsec);
  } catch (err) {
    logger.error({ err }, "stripe-checkout webhook signature failed");
    res.status(400).send("Webhook signature verification failed");
    return;
  }

  try {
    switch (event.type) {
      case "payment_intent.succeeded": {
        const pi = event.data.object as Stripe.PaymentIntent;
        await db.update(ordersTable)
          .set({ paymentStatus: "paid", updatedAt: new Date() })
          .where(eq(ordersTable.paymentIntentId, pi.id));
        await db.update(ordersTable)
          .set({ paymentStatus: "paid", updatedAt: new Date() })
          .where(eq(ordersTable.stripePaymentIntentId, pi.id));
        break;
      }
      case "payment_intent.payment_failed": {
        const pi = event.data.object as Stripe.PaymentIntent;
        await db.update(ordersTable)
          .set({ paymentStatus: "failed", updatedAt: new Date() })
          .where(eq(ordersTable.paymentIntentId, pi.id));
        await db.update(ordersTable)
          .set({ paymentStatus: "failed", updatedAt: new Date() })
          .where(eq(ordersTable.stripePaymentIntentId, pi.id));
        break;
      }
      default:
        break;
    }
  } catch (err) {
    logger.error({ err, type: event.type }, "stripe-checkout webhook handler error");
  }

  res.status(200).json({ received: true });
}

export default router;
