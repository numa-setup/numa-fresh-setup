import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { db } from "@workspace/db";
import { ordersTable, storesTable, usersTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { authenticate, type AuthRequest } from "../middlewares/authenticate.js";
import { logger } from "../lib/logger.js";
import { sendEmail, orderConfirmedEmail, orderCompletedEmail, refundProcessedEmail } from "../lib/email.js";
import { emitToStore, emitToAdmin } from "../socket/index.js";

const router = Router();

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  const Stripe = require("stripe");
  return new Stripe(key, { apiVersion: "2024-06-20" });
}

// POST /api/payments/create-intent
// Creates a PaymentIntent with manual capture for fresh meat orders
router.post("/payments/create-intent", authenticate, async (req: AuthRequest, res) => {
  const stripe = getStripe();
  if (!stripe) {
    return res.status(503).json({ error: "Payment service not configured. Set STRIPE_SECRET_KEY." });
  }
  try {
    const { orderId } = z.object({ orderId: z.string() }).parse(req.body);

    const order = await db.select({
      id: ordersTable.id,
      orderNumber: ordersTable.orderNumber,
      customerId: ordersTable.customerId,
      storeId: ordersTable.storeId,
      estimatedTotal: ordersTable.estimatedTotal,
      paymentStatus: ordersTable.paymentStatus,
    }).from(ordersTable).where(eq(ordersTable.id, orderId)).limit(1);

    if (!order[0]) return res.status(404).json({ error: "Order not found" });
    if (order[0].customerId !== req.user!.userId) return res.status(403).json({ error: "Forbidden" });
    if (order[0].paymentStatus !== "pending") return res.status(400).json({ error: "Payment already initiated" });

    const amountCents = Math.round(order[0].estimatedTotal * 100);

    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountCents,
      currency: "usd",
      capture_method: "manual",
      metadata: {
        orderId,
        orderNumber: order[0].orderNumber,
        customerId: order[0].customerId,
        storeId: order[0].storeId,
      },
    });

    await db.update(ordersTable)
      .set({ paymentIntentId: paymentIntent.id, paymentStatus: "authorized", preAuthAmount: order[0].estimatedTotal })
      .where(eq(ordersTable.id, orderId));

    return res.json({ clientSecret: paymentIntent.client_secret, paymentIntentId: paymentIntent.id });
  } catch (err) {
    logger.error({ err }, "create-intent failed");
    return res.status(500).json({ error: "Failed to create payment intent" });
  }
});

// PATCH /api/payments/capture
// Captures a previously authorized PaymentIntent (after final weight is confirmed)
router.patch("/payments/capture", authenticate, async (req: AuthRequest, res) => {
  const stripe = getStripe();
  if (!stripe) return res.status(503).json({ error: "Payment service not configured" });

  try {
    const { orderId, finalAmount } = z.object({
      orderId: z.string(),
      finalAmount: z.number().positive(),
    }).parse(req.body);

    const order = await db.select().from(ordersTable).where(eq(ordersTable.id, orderId)).limit(1);
    if (!order[0]) return res.status(404).json({ error: "Order not found" });
    if (!order[0].paymentIntentId) return res.status(400).json({ error: "No payment intent found" });

    const amountCents = Math.round(finalAmount * 100);

    await stripe.paymentIntents.update(order[0].paymentIntentId, {
      amount: amountCents,
    });

    const captured = await stripe.paymentIntents.capture(order[0].paymentIntentId);

    await db.update(ordersTable)
      .set({
        finalTotal: finalAmount,
        paymentStatus: "captured",
        finalCaptured: true,
        stripeChargeId: captured.latest_charge as string,
      })
      .where(eq(ordersTable.id, orderId));

    logger.info({ orderId, finalAmount }, "Payment captured successfully");
    return res.json({ success: true, captured });
  } catch (err) {
    logger.error({ err }, "capture failed");
    return res.status(500).json({ error: "Failed to capture payment" });
  }
});

// POST /api/payments/refund
router.post("/payments/refund", authenticate, async (req: AuthRequest, res) => {
  const stripe = getStripe();
  if (!stripe) return res.status(503).json({ error: "Payment service not configured" });

  try {
    const { orderId, amount, reason } = z.object({
      orderId: z.string(),
      amount: z.number().positive().optional(),
      reason: z.string().optional(),
    }).parse(req.body);

    const order = await db.select().from(ordersTable).where(eq(ordersTable.id, orderId)).limit(1);
    if (!order[0]) return res.status(404).json({ error: "Order not found" });
    if (!order[0].stripeChargeId && !order[0].paymentIntentId) {
      return res.status(400).json({ error: "No charge to refund" });
    }

    const refundData: Record<string, unknown> = {
      reason: "requested_by_customer",
    };
    if (order[0].stripeChargeId) refundData.charge = order[0].stripeChargeId;
    else refundData.payment_intent = order[0].paymentIntentId;
    if (amount) refundData.amount = Math.round(amount * 100);

    const refund = await stripe.refunds.create(refundData as any);

    await db.update(ordersTable).set({ paymentStatus: "refunded", status: "REFUNDED" }).where(eq(ordersTable.id, orderId));

    const customer = await db.select({ email: usersTable.email, firstName: usersTable.firstName })
      .from(usersTable).where(eq(usersTable.id, order[0].customerId)).limit(1);

    if (customer[0]) {
      await sendEmail(refundProcessedEmail({
        to: customer[0].email,
        firstName: customer[0].firstName,
        orderNumber: order[0].orderNumber,
        amount: amount || order[0].finalTotal || order[0].estimatedTotal,
      }));
    }

    return res.json({ success: true, refundId: refund.id });
  } catch (err) {
    logger.error({ err }, "refund failed");
    return res.status(500).json({ error: "Failed to process refund" });
  }
});

// POST /api/payments/webhook
// Stripe webhook handler — must be BEFORE express.json middleware
router.post("/payments/webhook", async (req: Request, res: Response) => {
  const stripe = getStripe();
  if (!stripe) return res.status(200).json({ received: true });

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    logger.warn("STRIPE_WEBHOOK_SECRET not set — skipping signature verification");
    return res.status(200).json({ received: true });
  }

  let event;
  try {
    const sig = req.headers["stripe-signature"] as string;
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err) {
    logger.error({ err }, "Webhook signature verification failed");
    return res.status(400).send("Webhook Error: Invalid signature");
  }

  try {
    switch (event.type) {
      case "payment_intent.succeeded": {
        const pi = event.data.object as any;
        const orderId = pi.metadata?.orderId;
        if (!orderId) break;

        await db.update(ordersTable)
          .set({ paymentStatus: "succeeded", status: "STORE_CONFIRMED" })
          .where(eq(ordersTable.id, orderId));

        const order = await db.select().from(ordersTable).where(eq(ordersTable.id, orderId)).limit(1);
        if (order[0]) {
          emitToStore(order[0].storeId, "new_order", { orderId, orderNumber: order[0].orderNumber });
          emitToAdmin("new_order", { orderId, orderNumber: order[0].orderNumber });
        }
        break;
      }

      case "payment_intent.payment_failed": {
        const pi = event.data.object as any;
        const orderId = pi.metadata?.orderId;
        if (orderId) {
          await db.update(ordersTable)
            .set({ paymentStatus: "failed" })
            .where(eq(ordersTable.id, orderId));
        }
        break;
      }

      case "payment_intent.canceled": {
        const pi = event.data.object as any;
        const orderId = pi.metadata?.orderId;
        if (orderId) {
          await db.update(ordersTable)
            .set({ paymentStatus: "cancelled", status: "CANCELLED" })
            .where(eq(ordersTable.id, orderId));
        }
        break;
      }

      case "charge.refunded": {
        logger.info({ chargeId: (event.data.object as any).id }, "Charge refunded via webhook");
        break;
      }

      default:
        logger.info({ type: event.type }, "Unhandled Stripe webhook event");
    }
  } catch (err) {
    logger.error({ err, eventType: event.type }, "Webhook handler error");
  }

  return res.json({ received: true });
});

// POST /api/store/connect/onboard — Stripe Connect onboarding
router.post("/store/connect/onboard", authenticate, async (req: AuthRequest, res) => {
  const stripe = getStripe();
  if (!stripe) return res.status(503).json({ error: "Payment service not configured" });

  try {
    const store = await db.select().from(storesTable)
      .where(eq(storesTable.ownerId, req.user!.userId)).limit(1);
    if (!store[0]) return res.status(404).json({ error: "Store not found" });

    let accountId = store[0].stripeAccountId;
    if (!accountId) {
      const account = await stripe.accounts.create({ type: "express", country: "US", email: store[0].email });
      accountId = account.id;
      await db.update(storesTable).set({ stripeAccountId: accountId }).where(eq(storesTable.id, store[0].id));
    }

    const frontendUrl = process.env.FRONTEND_URL || "https://numafresh.com";
    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${frontendUrl}/store-portal/settings?stripe=refresh`,
      return_url: `${frontendUrl}/store-portal/settings?stripe=success`,
      type: "account_onboarding",
    });

    return res.json({ url: accountLink.url });
  } catch (err) {
    logger.error({ err }, "Stripe Connect onboard failed");
    return res.status(500).json({ error: "Failed to create onboarding link" });
  }
});

export default router;
