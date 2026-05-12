/**
 * Public pickup verification routes.
 * No authentication required — designed to be scanned by any phone camera.
 */
import { Router } from "express";
import os from "os";
import { db } from "@workspace/db";
import {
  ordersTable, orderItemsTable, storesTable, usersTable,
} from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { authenticate, AuthRequest } from "../middlewares/authenticate.js";

/** Returns the best available local network IP (not localhost, not link-local) */
function getLocalIP(): string {
  const ifaces = os.networkInterfaces();
  for (const list of Object.values(ifaces)) {
    for (const iface of list ?? []) {
      if (iface.family === "IPv4" && !iface.internal && !iface.address.startsWith("169.")) {
        return iface.address;
      }
    }
  }
  return "localhost";
}

const router = Router();

// GET /api/pickup/local-url — returns the correct base URL for QR encoding
// Frontend calls this so QR codes encode the reachable URL, not localhost.
router.get("/local-url", (_req, res) => {
  // Priority: explicit env override → auto-detected LAN IP → fallback localhost
  const envUrl = process.env.PICKUP_BASE_URL
    || process.env.FRONTEND_URL
    || process.env.VITE_APP_URL;

  if (envUrl) {
    console.log(`[QR] Using env-configured base URL: ${envUrl}`);
    res.json({ baseUrl: envUrl, source: "env" });
    return;
  }

  const localIP = getLocalIP();
  // FRONTEND_PORT is optional override; default is 3000 (Vite dev server in this project).
  // We must NOT fall back to process.env.PORT here — that is the backend port (8080).
  const frontendPort = process.env.FRONTEND_PORT || "3000";
  const baseUrl = localIP === "localhost"
    ? `http://localhost:${frontendPort}`
    : `http://${localIP}:${frontendPort}`;

  console.log(`[QR] Auto-detected base URL: ${baseUrl}`);
  res.json({ baseUrl, source: "auto", localIP });
});

// GET /api/pickup/verify/:orderId — PUBLIC, no auth required
// Returns clean order data for the verification page
router.get("/verify/:orderId", async (req, res) => {
  try {
    const { orderId } = req.params;

    const [order] = await db
      .select()
      .from(ordersTable)
      .where(eq(ordersTable.id, orderId))
      .limit(1);

    if (!order) {
      res.status(404).json({
        success: false,
        error: "ORDER_NOT_FOUND",
        message: "This QR code is invalid or the order does not exist.",
      });
      return;
    }

    const [store, customer, items] = await Promise.all([
      db.select({
        name: storesTable.name,
        address: storesTable.address,
        city: storesTable.city,
        phone: storesTable.phone,
        ownerId: storesTable.ownerId,
      })
        .from(storesTable)
        .where(eq(storesTable.id, order.storeId))
        .limit(1)
        .then(r => r[0]),

      db.select({
        firstName: usersTable.firstName,
        lastName: usersTable.lastName,
      })
        .from(usersTable)
        .where(eq(usersTable.id, order.customerId))
        .limit(1)
        .then(r => r[0]),

      db.select({
        name: orderItemsTable.name,
        quantity: orderItemsTable.quantity,
        totalPrice: orderItemsTable.totalPrice,
        finalPrice: orderItemsTable.finalPrice,
        unitPrice: orderItemsTable.unitPrice,
      })
        .from(orderItemsTable)
        .where(eq(orderItemsTable.orderId, orderId)),
    ]);

    // Derive pickup code from pickupQrCode field
    const rawCode = order.pickupQrCode;
    const pickupCode = (rawCode && rawCode.startsWith("PKP-") && rawCode.length <= 15)
      ? rawCode
      : `PKP-${order.id.replace(/-/g, "").slice(0, 6).toUpperCase()}`;

    const total = Number(order.finalTotal ?? order.estimatedTotal ?? 0);

    // QR is only invalid once the order is no longer READY_FOR_PICKUP.
    // We do NOT expire based on time — that causes false "expired" warnings.
    const isExpired = order.status !== "READY_FOR_PICKUP" && order.status !== "COMPLETED";

    res.json({
      success: true,
      order: {
        id: order.id,
        orderNumber: order.orderNumber,
        status: order.status,
        customerName: customer
          ? `${customer.firstName} ${customer.lastName}`.trim()
          : "Customer",
        storeName: store?.name ?? "Numa Fresh",
        storeAddress: store
          ? `${store.address ?? ""}${store.city ? ", " + store.city : ""}`.trim()
          : "",
        storePhone: store?.phone ?? "",
        storeOwnerId: store?.ownerId ?? null,
        orderDate: order.createdAt,
        readyAt: order.readyAt,
        completedAt: order.completedAt,
        items: items.map(i => ({
          name: i.name,
          quantity: Number(i.quantity),
          price: `$${Number(i.finalPrice ?? i.totalPrice ?? i.unitPrice ?? 0).toFixed(2)}`,
        })),
        totalAmount: `$${total.toFixed(2)}`,
        pickupCode,
        validUntil: null,
        isExpired,
      },
    });
  } catch (err) {
    console.error("Pickup verify error:", err);
    res.status(500).json({
      success: false,
      error: "SERVER_ERROR",
      message: "Unable to load order details. Please try again.",
    });
  }
});

// POST /api/pickup/verify/:orderId/collect — Mark order as collected
// Requires authentication — only store owner/staff of that store
router.post("/verify/:orderId/collect", authenticate, async (req: AuthRequest, res) => {
  try {
    const { orderId } = req.params;
    const userId = req.user!.userId;

    const [order] = await db
      .select()
      .from(ordersTable)
      .where(eq(ordersTable.id, orderId))
      .limit(1);

    if (!order) {
      res.status(404).json({ success: false, message: "Order not found" });
      return;
    }

    // Only the store owner of this specific store (or ADMIN) can mark as collected
    if (req.user!.role !== "ADMIN") {
      const [store] = await db
        .select({ ownerId: storesTable.ownerId })
        .from(storesTable)
        .where(eq(storesTable.id, order.storeId))
        .limit(1);
      if (!store || store.ownerId !== userId) {
        res.status(403).json({ success: false, message: "Not authorized" });
        return;
      }
    }

    if (order.status === "COMPLETED") {
      res.json({ success: true, alreadyCollected: true, status: "COMPLETED" });
      return;
    }

    await db
      .update(ordersTable)
      .set({ status: "COMPLETED", completedAt: new Date(), updatedAt: new Date() })
      .where(eq(ordersTable.id, orderId));

    res.json({ success: true, status: "COMPLETED" });
  } catch (err) {
    console.error("Mark collected error:", err);
    res.status(500).json({ success: false, message: "Failed to update order" });
  }
});

export default router;
