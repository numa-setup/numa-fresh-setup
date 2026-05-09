import { Router } from "express";
import { db } from "@workspace/db";
import {
  storesTable, productsTable, ordersTable, orderItemsTable, usersTable, orderStatusHistoryTable
} from "@workspace/db/schema";
import { eq, and, desc, count, sql, inArray, gte, lt, between, or, ilike } from "drizzle-orm";
import { authenticate, authorize, AuthRequest } from "../middlewares/authenticate.js";
import { createNotification } from "./notifications.js";

const router = Router();

/** Generates a human-readable 6-char alphanumeric pickup code, e.g. "PKP-A3Z7XQ" */
function generateStorePickupCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "PKP-";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

// All store routes require authentication
router.use(authenticate);
router.use(authorize("STORE_OWNER", "STORE_STAFF", "ADMIN"));

// Helper: get store for the authenticated user.
// For STORE_OWNER/ADMIN, looks up by ownerId.
// For STORE_STAFF, looks up any store (placeholder — schema has no staff→store FK yet).
async function getOwnerStore(userId: string, role?: string) {
  if (role === "STORE_STAFF") {
    // STORE_STAFF have no direct ownerId link; return null gracefully.
    // Full STORE_STAFF support requires adding a storeId FK to the users table.
    return null;
  }
  const [store] = await db.select().from(storesTable).where(eq(storesTable.ownerId, userId)).limit(1);
  return store;
}

// ─── DASHBOARD ──────────────────────────────────────────────
// GET /api/store/dashboard
router.get("/dashboard", async (req: AuthRequest, res) => {
  try {
    const store = await getOwnerStore(req.user!.userId, req.user!.role);
    if (!store) { res.status(404).json({ error: "NoStore", message: "No store found for this account" }); return; }

    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(); todayEnd.setHours(23, 59, 59, 999);

    const [
      allOrders,
      todayOrders,
      pendingOrders,
      preparingOrders,
      readyOrders,
      completedToday,
    ] = await Promise.all([
      db.select({ id: ordersTable.id, finalTotal: ordersTable.finalTotal, estimatedTotal: ordersTable.estimatedTotal, status: ordersTable.status })
        .from(ordersTable).where(eq(ordersTable.storeId, store.id)),
      db.select({ id: ordersTable.id, finalTotal: ordersTable.finalTotal, estimatedTotal: ordersTable.estimatedTotal })
        .from(ordersTable).where(and(eq(ordersTable.storeId, store.id), gte(ordersTable.createdAt, todayStart), lt(ordersTable.createdAt, todayEnd))),
      db.select({ count: count() }).from(ordersTable).where(and(eq(ordersTable.storeId, store.id), eq(ordersTable.status, "PENDING"))),
      db.select({ count: count() }).from(ordersTable).where(and(eq(ordersTable.storeId, store.id), eq(ordersTable.status, "IN_PREPARATION"))),
      db.select({ count: count() }).from(ordersTable).where(and(eq(ordersTable.storeId, store.id), eq(ordersTable.status, "READY_FOR_PICKUP"))),
      db.select({ count: count() }).from(ordersTable).where(and(eq(ordersTable.storeId, store.id), eq(ordersTable.status, "COMPLETED"), gte(ordersTable.createdAt, todayStart))),
    ]);

    const todayRevenue = todayOrders.reduce((s, o) => s + Number(o.finalTotal || o.estimatedTotal || 0), 0);
    const totalRevenue = allOrders.reduce((s, o) => s + Number(o.finalTotal || o.estimatedTotal || 0), 0);
    const completedOrders = allOrders.filter(o => o.status === "COMPLETED");
    const avgOrderValue = completedOrders.length > 0 ? totalRevenue / completedOrders.length : 0;

    const uniqueCustomers = await db
      .selectDistinct({ customerId: ordersTable.customerId })
      .from(ordersTable)
      .where(eq(ordersTable.storeId, store.id));

    res.json({
      store: { id: store.id, name: store.name, slug: store.slug, isActive: store.isActive, isActiveManual: store.isActiveManual, isCurrentlyOpen: store.isCurrentlyOpen, logo: store.logo },
      todayRevenue,
      todayOrders: todayOrders.length,
      pendingOrders: pendingOrders[0]?.count ?? 0,
      preparingOrders: preparingOrders[0]?.count ?? 0,
      readyOrders: readyOrders[0]?.count ?? 0,
      completedToday: completedToday[0]?.count ?? 0,
      totalRevenue,
      totalOrders: allOrders.length,
      totalCustomers: uniqueCustomers.length,
      avgOrderValue,
      avgPrepTime: store.avgPrepTimeMinutes ?? 0,
      rating: store.rating,
    });
  } catch (err) {
    req.log.error({ err }, "Dashboard error");
    res.status(500).json({ error: "ServerError", message: "Failed to load dashboard" });
  }
});

// ─── ORDERS ─────────────────────────────────────────────────
// GET /api/store/orders
router.get("/orders", async (req: AuthRequest, res) => {
  try {
    const store = await getOwnerStore(req.user!.userId, req.user!.role);
    if (!store) { res.status(404).json({ error: "NoStore", message: "No store found" }); return; }

    const { status, page = "1", limit = "50" } = req.query as Record<string, string>;
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, parseInt(limit) || 50);
    const offset = (pageNum - 1) * limitNum;

    const conditions: any[] = [eq(ordersTable.storeId, store.id)];
    if (status) {
      const statuses = status.split(',').map(s => s.trim()).filter(Boolean);
      if (statuses.length === 1) {
        conditions.push(eq(ordersTable.status, statuses[0] as any));
      } else if (statuses.length > 1) {
        conditions.push(inArray(ordersTable.status, statuses as any[]));
      }
    }

    const [orders, totalResult] = await Promise.all([
      db.select().from(ordersTable).where(and(...conditions)).orderBy(desc(ordersTable.createdAt)).limit(limitNum).offset(offset),
      db.select({ count: count() }).from(ordersTable).where(and(...conditions)),
    ]);

    const orderIds = orders.map(o => o.id);
    const customerIds = [...new Set(orders.map(o => o.customerId))];

    const [allItems, customers] = await Promise.all([
      orderIds.length > 0 ? db.select().from(orderItemsTable).where(inArray(orderItemsTable.orderId, orderIds)) : Promise.resolve([]),
      customerIds.length > 0 ? db.select({ id: usersTable.id, firstName: usersTable.firstName, lastName: usersTable.lastName, phone: usersTable.phone, email: usersTable.email }).from(usersTable).where(inArray(usersTable.id, customerIds)) : Promise.resolve([]),
    ]);

    const itemsByOrder = allItems.reduce((acc, item) => {
      if (!acc[item.orderId]) acc[item.orderId] = [];
      acc[item.orderId].push(item);
      return acc;
    }, {} as Record<string, typeof allItems>);

    const customerMap = Object.fromEntries(customers.map(c => [c.id, c]));

    const ordersWithDetails = orders.map(o => ({
      ...o,
      items: itemsByOrder[o.id] || [],
      customer: customerMap[o.customerId],
    }));

    const total = totalResult[0]?.count ?? 0;
    res.json({ orders: ordersWithDetails, total, page: pageNum, totalPages: Math.ceil(total / limitNum) });
  } catch (err) {
    req.log.error({ err }, "Store orders error");
    res.status(500).json({ error: "ServerError", message: "Failed to fetch orders" });
  }
});

// GET /api/store/orders/:id
router.get("/orders/:id", async (req: AuthRequest, res) => {
  try {
    const store = await getOwnerStore(req.user!.userId, req.user!.role);
    if (!store) { res.status(404).json({ error: "NoStore", message: "No store found" }); return; }

    const [order] = await db.select().from(ordersTable).where(and(eq(ordersTable.id, req.params.id), eq(ordersTable.storeId, store.id))).limit(1);
    if (!order) { res.status(404).json({ error: "NotFound", message: "Order not found" }); return; }

    const [rawItems, customer, history, storeData] = await Promise.all([
      db.select().from(orderItemsTable).where(eq(orderItemsTable.orderId, order.id)),
      db.select({ id: usersTable.id, firstName: usersTable.firstName, lastName: usersTable.lastName, phone: usersTable.phone, email: usersTable.email }).from(usersTable).where(eq(usersTable.id, order.customerId)).limit(1).then(r => r[0]),
      db.select().from(orderStatusHistoryTable).where(eq(orderStatusHistoryTable.orderId, order.id)).orderBy(desc(orderStatusHistoryTable.createdAt)),
      db.select({ id: storesTable.id, name: storesTable.name, phone: storesTable.phone, address: storesTable.address, city: storesTable.city }).from(storesTable).where(eq(storesTable.id, order.storeId)).limit(1).then(r => r[0]),
    ]);

    // Attach product images to each order item
    let items = rawItems as any[];
    if (rawItems.length > 0) {
      const productIds = [...new Set(rawItems.map(i => i.productId).filter(Boolean))];
      const products = await db
        .select({ id: productsTable.id, images: productsTable.images })
        .from(productsTable)
        .where(inArray(productsTable.id, productIds));
      const productImageMap = Object.fromEntries(products.map(p => [p.id, (p.images as string[]) ?? []]));
      items = rawItems.map(item => ({ ...item, images: productImageMap[item.productId] ?? [] }));
    }

    res.json({ ...order, items, customer, history, store: storeData });
  } catch (err) {
    req.log.error({ err }, "Get order error");
    res.status(500).json({ error: "ServerError", message: "Failed to fetch order" });
  }
});

// PATCH /api/store/orders/:id/confirm
router.patch("/orders/:id/confirm", async (req: AuthRequest, res) => {
  try {
    const store = await getOwnerStore(req.user!.userId, req.user!.role);
    if (!store) { res.status(404).json({ error: "NoStore" }); return; }

    const [order] = await db.select().from(ordersTable).where(and(eq(ordersTable.id, req.params.id), eq(ordersTable.storeId, store.id))).limit(1);
    if (!order) { res.status(404).json({ error: "NotFound" }); return; }

    await db.update(ordersTable).set({ status: "STORE_CONFIRMED", updatedAt: new Date() }).where(eq(ordersTable.id, order.id));
    await db.insert(orderStatusHistoryTable).values({ orderId: order.id, status: "STORE_CONFIRMED", note: "Confirmed by store" });

    res.json({ success: true, status: "STORE_CONFIRMED" });
  } catch (err) {
    req.log.error({ err }, "Confirm order error");
    res.status(500).json({ error: "ServerError" });
  }
});

// PATCH /api/store/orders/:id/reject
router.patch("/orders/:id/reject", async (req: AuthRequest, res) => {
  try {
    const store = await getOwnerStore(req.user!.userId, req.user!.role);
    if (!store) { res.status(404).json({ error: "NoStore" }); return; }

    const { reason = "Store unavailable" } = req.body;
    const [order] = await db.select().from(ordersTable).where(and(eq(ordersTable.id, req.params.id), eq(ordersTable.storeId, store.id))).limit(1);
    if (!order) { res.status(404).json({ error: "NotFound" }); return; }

    await db.update(ordersTable).set({ status: "CANCELLED", cancellationReason: reason, updatedAt: new Date() }).where(eq(ordersTable.id, order.id));
    await db.insert(orderStatusHistoryTable).values({ orderId: order.id, status: "CANCELLED", note: reason });

    res.json({ success: true, status: "CANCELLED" });
  } catch (err) {
    req.log.error({ err }, "Reject order error");
    res.status(500).json({ error: "ServerError" });
  }
});

// PATCH /api/store/orders/:id/status
router.patch("/orders/:id/status", async (req: AuthRequest, res) => {
  try {
    const store = await getOwnerStore(req.user!.userId, req.user!.role);
    if (!store) { res.status(404).json({ error: "NoStore" }); return; }

    const { status, note } = req.body;
    const validStatuses = ["STORE_CONFIRMED", "IN_PREPARATION", "REPLACEMENT_HANDLING", "READY_FOR_PICKUP", "COMPLETED", "CANCELLED", "REFUNDED"];
    if (!validStatuses.includes(status)) { res.status(400).json({ error: "InvalidStatus" }); return; }

    const [order] = await db.select().from(ordersTable).where(and(eq(ordersTable.id, req.params.id), eq(ordersTable.storeId, store.id))).limit(1);
    if (!order) { res.status(404).json({ error: "NotFound" }); return; }

    // Generate pickup code when transitioning to READY_FOR_PICKUP
    const statusUpdateData: Record<string, any> = { status, updatedAt: new Date() };
    if (status === "READY_FOR_PICKUP") {
      statusUpdateData.readyAt = new Date();
      const existingCode = order.pickupQrCode;
      statusUpdateData.pickupQrCode = (existingCode && existingCode.startsWith("PKP-") && existingCode.length <= 15)
        ? existingCode
        : generateStorePickupCode();
    }
    if (status === "COMPLETED") statusUpdateData.completedAt = new Date();

    await db.update(ordersTable).set(statusUpdateData).where(eq(ordersTable.id, order.id));
    await db.insert(orderStatusHistoryTable).values({ orderId: order.id, status, note: note || `Status updated to ${status}` });

    const statusLabels: Record<string, string> = {
      STORE_CONFIRMED: "Order Confirmed",
      IN_PREPARATION: "Order Being Prepared",
      READY_FOR_PICKUP: "Order Ready for Pickup",
      COMPLETED: "Order Completed",
      CANCELLED: "Order Cancelled",
      REPLACEMENT_HANDLING: "Order Needs Your Response",
      REFUNDED: "Order Refunded",
    };
    const statusLabel = statusLabels[status] || status.replace(/_/g, " ");
    createNotification(
      order.customerId,
      "ORDER_STATUS",
      statusLabel,
      `Your order #${order.orderNumber} is now: ${statusLabel.toLowerCase()}.`,
      { orderId: order.id, orderNumber: order.orderNumber, status },
      order.id
    ).catch(() => {});

    res.json({ success: true, status });
  } catch (err) {
    req.log.error({ err }, "Update order status error");
    res.status(500).json({ error: "ServerError" });
  }
});

// PATCH /api/store/orders/:id/item-status — Mark item found/out-of-stock
router.patch("/orders/:id/item-status", async (req: AuthRequest, res) => {
  try {
    const store = await getOwnerStore(req.user!.userId, req.user!.role);
    if (!store) { res.status(404).json({ error: "NoStore" }); return; }

    const { itemId, itemStatus, substituteProductId } = req.body;

    const [order] = await db.select().from(ordersTable).where(and(eq(ordersTable.id, req.params.id), eq(ordersTable.storeId, store.id))).limit(1);
    if (!order) { res.status(404).json({ error: "NotFound" }); return; }

    const updateData: any = { itemStatus, updatedAt: new Date() };
    if (substituteProductId) updateData.substituteProductId = substituteProductId;

    await db.update(orderItemsTable).set(updateData).where(and(eq(orderItemsTable.id, itemId), eq(orderItemsTable.orderId, order.id)));

    res.json({ success: true, itemId, itemStatus });
  } catch (err) {
    req.log.error({ err }, "Item status error");
    res.status(500).json({ error: "ServerError" });
  }
});

// PATCH /api/store/orders/:id/meat-weight — Enter actual weight for fresh meat items
router.patch("/orders/:id/meat-weight", async (req: AuthRequest, res) => {
  try {
    const store = await getOwnerStore(req.user!.userId, req.user!.role);
    if (!store) { res.status(404).json({ error: "NoStore" }); return; }

    const { itemId, actualWeight } = req.body;
    if (!itemId || actualWeight === undefined) { res.status(400).json({ error: "MissingFields" }); return; }

    const [order] = await db.select().from(ordersTable).where(and(eq(ordersTable.id, req.params.id), eq(ordersTable.storeId, store.id))).limit(1);
    if (!order) { res.status(404).json({ error: "NotFound" }); return; }

    const [item] = await db.select().from(orderItemsTable).where(and(eq(orderItemsTable.id, itemId), eq(orderItemsTable.orderId, order.id))).limit(1);
    if (!item) { res.status(404).json({ error: "ItemNotFound" }); return; }

    const finalPrice = Number(item.pricePerKg || item.unitPrice) * Number(actualWeight);
    await db.update(orderItemsTable).set({ actualWeight: String(actualWeight), finalPrice: String(finalPrice), itemStatus: "WEIGHED", updatedAt: new Date() }).where(eq(orderItemsTable.id, itemId));

    res.json({ success: true, itemId, actualWeight, finalPrice });
  } catch (err) {
    req.log.error({ err }, "Meat weight error");
    res.status(500).json({ error: "ServerError" });
  }
});

// POST /api/store/orders/:id/mark-ready
router.post("/orders/:id/mark-ready", async (req: AuthRequest, res) => {
  try {
    const store = await getOwnerStore(req.user!.userId, req.user!.role);
    if (!store) { res.status(404).json({ error: "NoStore" }); return; }

    const [order] = await db.select().from(ordersTable).where(and(eq(ordersTable.id, req.params.id), eq(ordersTable.storeId, store.id))).limit(1);
    if (!order) { res.status(404).json({ error: "NotFound" }); return; }

    // Generate and store pickup code in pickupQrCode field (no migration needed)
    const existing = order.pickupQrCode;
    const pickupCode = (existing && existing.startsWith("PKP-") && existing.length <= 15)
      ? existing
      : generateStorePickupCode();
    await db.update(ordersTable)
      .set({ status: "READY_FOR_PICKUP", readyAt: new Date(), pickupQrCode: pickupCode, updatedAt: new Date() })
      .where(eq(ordersTable.id, order.id));
    await db.insert(orderStatusHistoryTable).values({ orderId: order.id, status: "READY_FOR_PICKUP", note: "Order ready for customer pickup" });

    res.json({ success: true, status: "READY_FOR_PICKUP", pickupCode });
  } catch (err) {
    req.log.error({ err }, "Mark ready error");
    res.status(500).json({ error: "ServerError" });
  }
});

// POST /api/store/orders/:id/curbside-delivered
router.post("/orders/:id/curbside-delivered", async (req: AuthRequest, res) => {
  try {
    const store = await getOwnerStore(req.user!.userId, req.user!.role);
    if (!store) { res.status(404).json({ error: "NoStore" }); return; }

    await db.update(ordersTable).set({ status: "COMPLETED", updatedAt: new Date() }).where(and(eq(ordersTable.id, req.params.id), eq(ordersTable.storeId, store.id)));
    await db.insert(orderStatusHistoryTable).values({ orderId: req.params.id, status: "COMPLETED", note: "Delivered to customer vehicle" });

    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Curbside delivered error");
    res.status(500).json({ error: "ServerError" });
  }
});

// ─── PRODUCTS ────────────────────────────────────────────────
// GET /api/store/products
router.get("/products", async (req: AuthRequest, res) => {
  try {
    const store = await getOwnerStore(req.user!.userId, req.user!.role);
    if (!store) { res.status(404).json({ error: "NoStore" }); return; }

    const { category, search, page = "1", limit = "20" } = req.query as Record<string, string>;
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(1000, parseInt(limit) || 20);
    const offset = (pageNum - 1) * limitNum;

    const conditions: any[] = [eq(productsTable.storeId, store.id)];
    if (category) conditions.push(eq(productsTable.category, category));
    if (search) {
      conditions.push(or(
        ilike(productsTable.name, `%${search}%`),
        ilike(productsTable.category, `%${search}%`),
        ilike(productsTable.sku, `%${search}%`),
      ));
    }

    const [products, totalResult] = await Promise.all([
      db.select().from(productsTable).where(and(...conditions)).orderBy(desc(productsTable.createdAt)).limit(limitNum).offset(offset),
      db.select({ count: count() }).from(productsTable).where(and(...conditions)),
    ]);

    res.json({ products, total: totalResult[0]?.count ?? 0, page: pageNum, totalPages: Math.ceil((totalResult[0]?.count ?? 0) / limitNum) });
  } catch (err) {
    req.log.error({ err }, "Store products error");
    res.status(500).json({ error: "ServerError" });
  }
});

// POST /api/store/products
router.post("/products", async (req: AuthRequest, res) => {
  try {
    const store = await getOwnerStore(req.user!.userId, req.user!.role);
    if (!store) { res.status(404).json({ error: "NoStore" }); return; }

    const { name, nameUrdu, description, productType, category, subcategory, tags, price, comparePrice, unit, stockQty, lowStockThreshold, images, isHalalCertified, isFeatured, freshnessLabel, animalType, availableCuts, pricePerKg, sku, productDetails, ingredients, directions, nutritionJson, certifiedFrom, expiryDate } = req.body;
    if (!name || !productType || price === undefined) { res.status(400).json({ error: "ValidationError", message: "name, productType, and price are required" }); return; }

    const baseSlug = String(name)
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "product";
    const slug = `${baseSlug}-${Math.random().toString(36).slice(2, 8)}`;

    const [product] = await db.insert(productsTable).values({
      storeId: store.id,
      slug,
      name, nameUrdu: nameUrdu || null, description: description || null,
      productType, category: category || "OTHER",
      price: String(price), comparePrice: comparePrice ? String(comparePrice) : null,
      unit: unit || "piece", stockQty: stockQty ?? 999,
      lowStockThreshold: lowStockThreshold ?? 5,
      images: images || [],
      isHalalCertified: isHalalCertified ?? true,
      isFeatured: isFeatured ?? false,
      isActive: true,
      // Owner-submitted products always start as pending — admin must approve
      isApproved: false,
      approvalStatus: "pending",
      freshnessLabel: freshnessLabel || null,
      animalType: animalType || null,
      availableCuts: availableCuts || [],
      pricePerKg: pricePerKg ? String(pricePerKg) : null,
      sku: sku || null,
      productDetails: productDetails || null,
      ingredients: ingredients || null,
      directions: directions || null,
      nutritionJson: nutritionJson ?? null,
      subcategory: subcategory || null,
      certifiedFrom: certifiedFrom || null,
      expiryDate: expiryDate || null,
      tags: Array.isArray(tags) ? tags : [],
    }).returning();

    // Notify admins so the product appears in the pending approval queue in real time
    try {
      const { emitNewProductPending } = await import("../socket/index.js");
      emitNewProductPending(product.id, store.id, store.name, product.name);
    } catch (e) {
      req.log.warn({ e }, "Failed to emit emitNewProductPending");
    }

    res.status(201).json(product);
  } catch (err) {
    req.log.error({ err }, "Create product error");
    res.status(500).json({ error: "ServerError" });
  }
});

// PUT /api/store/products/:id
router.put("/products/:id", async (req: AuthRequest, res) => {
  try {
    const store = await getOwnerStore(req.user!.userId, req.user!.role);
    if (!store) { res.status(404).json({ error: "NoStore" }); return; }

    const [existing] = await db.select().from(productsTable).where(and(eq(productsTable.id, req.params.id), eq(productsTable.storeId, store.id))).limit(1);
    if (!existing) { res.status(404).json({ error: "NotFound" }); return; }

    const { name, nameUrdu, description, productType, category, subcategory, tags, price, comparePrice, unit, stockQty, lowStockThreshold, images, isHalalCertified, isFeatured, isActive, freshnessLabel, animalType, availableCuts, pricePerKg, sku, productDetails, ingredients, directions, nutritionJson, certifiedFrom, expiryDate } = req.body;

    const updateData: any = { updatedAt: new Date() };
    if (name !== undefined) updateData.name = name;
    if (nameUrdu !== undefined) updateData.nameUrdu = nameUrdu;
    if (description !== undefined) updateData.description = description;
    if (productType !== undefined) updateData.productType = productType;
    if (category !== undefined) updateData.category = category;
    if (price !== undefined) updateData.price = String(price);
    if (comparePrice !== undefined) updateData.comparePrice = comparePrice ? String(comparePrice) : null;
    if (unit !== undefined) updateData.unit = unit;
    if (stockQty !== undefined) updateData.stockQty = stockQty;
    if (lowStockThreshold !== undefined) updateData.lowStockThreshold = lowStockThreshold;
    if (images !== undefined) updateData.images = images;
    if (isHalalCertified !== undefined) updateData.isHalalCertified = isHalalCertified;
    if (isFeatured !== undefined) updateData.isFeatured = isFeatured;
    if (isActive !== undefined) updateData.isActive = isActive;
    if (freshnessLabel !== undefined) updateData.freshnessLabel = freshnessLabel;
    if (animalType !== undefined) updateData.animalType = animalType;
    if (availableCuts !== undefined) updateData.availableCuts = availableCuts;
    if (pricePerKg !== undefined) updateData.pricePerKg = pricePerKg ? String(pricePerKg) : null;
    if (sku !== undefined) updateData.sku = sku;
    if (productDetails !== undefined) updateData.productDetails = productDetails || null;
    if (ingredients !== undefined) updateData.ingredients = ingredients || null;
    if (directions !== undefined) updateData.directions = directions || null;
    if (nutritionJson !== undefined) updateData.nutritionJson = nutritionJson ?? null;
    if (subcategory !== undefined) updateData.subcategory = subcategory || null;
    if (certifiedFrom !== undefined) updateData.certifiedFrom = certifiedFrom || null;
    if (expiryDate !== undefined) updateData.expiryDate = expiryDate || null;
    if (tags !== undefined) updateData.tags = Array.isArray(tags) ? tags : [];

    const [updated] = await db.update(productsTable).set(updateData).where(eq(productsTable.id, req.params.id)).returning();
    res.json(updated);
  } catch (err) {
    req.log.error({ err }, "Update product error");
    res.status(500).json({ error: "ServerError" });
  }
});

// DELETE /api/store/products/:id
router.delete("/products/:id", async (req: AuthRequest, res) => {
  try {
    const store = await getOwnerStore(req.user!.userId, req.user!.role);
    if (!store) { res.status(404).json({ error: "NoStore" }); return; }

    await db.delete(productsTable).where(and(eq(productsTable.id, req.params.id), eq(productsTable.storeId, store.id)));
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Delete product error");
    res.status(500).json({ error: "ServerError" });
  }
});

// PATCH /api/store/products/:id/stock
router.patch("/products/:id/stock", async (req: AuthRequest, res) => {
  try {
    const store = await getOwnerStore(req.user!.userId, req.user!.role);
    if (!store) { res.status(404).json({ error: "NoStore" }); return; }

    const { stockQty, isActive } = req.body;
    const updateData: any = { updatedAt: new Date() };
    if (stockQty !== undefined) updateData.stockQty = stockQty;
    if (isActive !== undefined) updateData.isActive = isActive;

    const [updated] = await db.update(productsTable).set(updateData).where(and(eq(productsTable.id, req.params.id), eq(productsTable.storeId, store.id))).returning();
    res.json(updated);
  } catch (err) {
    req.log.error({ err }, "Update stock error");
    res.status(500).json({ error: "ServerError" });
  }
});

// POST /api/store/products/bulk-import
const VALID_PRODUCT_TYPES = ["PACKAGED", "FRESH_MEAT", "PRODUCE", "FROZEN", "SPICES", "BAKERY", "DAIRY", "BEVERAGES"] as const;
function toSlug(name: string, suffix: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") + "-" + suffix;
}
/**
 * Normalize a CSV/Excel row so column names are matched regardless of
 * capitalisation, spaces, underscores, asterisks, or surrounding whitespace.
 * e.g. "Product Name", "product_name", "name*", "NAME" all map to "name".
 */
function normalizeKey(k: string): string {
  return k.toLowerCase().replace(/[*\s]+/g, "_").replace(/_{2,}/g, "_").replace(/^_|_$/g, "");
}
function normalizeRow(row: Record<string, any>): Record<string, any> {
  const out: Record<string, any> = {};
  for (const k of Object.keys(row)) {
    out[normalizeKey(k)] = row[k];
    out[k] = row[k]; // keep original too for safety
  }
  return out;
}
/** Pick the first defined non-empty value from a list of candidate keys. */
function pick(row: Record<string, any>, ...keys: string[]): any {
  for (const k of keys) {
    const v = row[k];
    if (v !== undefined && v !== null && v !== "") return v;
  }
  return undefined;
}

router.post("/products/bulk-import", async (req: AuthRequest, res) => {
  try {
    const store = await getOwnerStore(req.user!.userId, req.user!.role);
    if (!store) { res.status(404).json({ error: "NoStore" }); return; }

    const { products: rows } = req.body;
    if (!Array.isArray(rows) || rows.length === 0) {
      res.status(400).json({ error: "ValidationError", message: "products array required" });
      return;
    }
    if (rows.length > 500) {
      res.status(400).json({ error: "TooMany", message: "Max 500 products per import" });
      return;
    }

    const inserted: any[] = [];
    const errors: { row: number; reason: string }[] = [];

    for (let i = 0; i < rows.length; i++) {
      // Normalize all column names so any capitalisation/spacing works
      const row = normalizeRow(rows[i]);

      const name = String(pick(row, "name", "product_name", "product name", "item_name", "item name", "title") ?? "").trim();
      const rawPrice = pick(row, "price", "unit_price", "unit price", "sale_price", "sale price", "cost");

      if (!name) {
        errors.push({ row: i + 1, reason: "Missing required field: name (check column header is 'name')" });
        continue;
      }
      if (rawPrice === undefined || rawPrice === null || String(rawPrice).trim() === "") {
        errors.push({ row: i + 1, reason: "Missing required field: price (check column header is 'price')" });
        continue;
      }
      const price = Number(rawPrice);
      if (isNaN(price) || price < 0) {
        errors.push({ row: i + 1, reason: `Invalid price value: "${rawPrice}"` });
        continue;
      }

      // Product type — accepts any reasonable variation, defaults to PACKAGED
      const rawType = String(pick(row, "producttype", "product_type", "product type", "type", "category_type") ?? "PACKAGED").toUpperCase().trim().replace(/\s+/g, "_");
      const productType = (VALID_PRODUCT_TYPES as readonly string[]).includes(rawType) ? rawType as typeof VALID_PRODUCT_TYPES[number] : "PACKAGED";

      // Collect up to 4 image URLs from image1..image4 columns (or legacy 'images' column)
      const imageUrls: string[] = [];
      const legacyImages = pick(row, "images", "image", "image_url", "imageurl", "photo");
      if (legacyImages) {
        if (Array.isArray(legacyImages)) imageUrls.push(...legacyImages.filter(Boolean));
        else { const v = String(legacyImages).trim(); if (v) imageUrls.push(v); }
      }
      for (let n = 1; n <= 4; n++) {
        const v = String(pick(row, `image${n}`, `image_${n}`, `image ${n}`) ?? "").trim();
        if (v && !imageUrls.includes(v)) imageUrls.push(v);
      }

      // Generate unique slug
      const slug = toSlug(name, `${store.id.slice(0, 6)}-${Date.now()}-${i}`);

      try {
        const [p] = await db.insert(productsTable).values({
          storeId: store.id,
          slug,
          name,
          nameUrdu: String(pick(row, "nameurdu", "name_urdu", "urdu_name", "urduname") ?? "").trim() || null,
          description: String(pick(row, "description", "desc", "details", "product_description") ?? "").trim() || null,
          productType,
          category: String(pick(row, "category", "cat", "product_category") ?? "OTHER").trim() || "OTHER",
          price,
          comparePrice: (() => { const v = pick(row, "compareprice", "compare_price", "original_price", "was_price", "mrp"); return v ? Number(v) || null : null; })(),
          unit: String(pick(row, "unit", "unit_of_measure", "uom", "measurement") ?? "piece").trim() || "piece",
          stockQty: Number(pick(row, "stockqty", "stock_qty", "stock", "quantity", "qty", "inventory") ?? 999) || 999,
          lowStockThreshold: Number(pick(row, "lowstockthreshold", "low_stock_threshold", "low_stock", "reorder_point") ?? 5) || 5,
          images: imageUrls,
          isHalalCertified: String(pick(row, "ishalalcertified", "is_halal_certified", "halal", "halal_certified") ?? "true").toLowerCase() !== "false",
          isFeatured: String(pick(row, "isfeatured", "is_featured", "featured") ?? "false").toLowerCase() === "true",
          isActive: true,
          isApproved: false,
          approvalStatus: "pending",
          sku: String(pick(row, "sku", "barcode", "upc", "product_code", "item_code") ?? "").trim() || null,
          tags: [],
        }).returning();
        inserted.push(p);
      } catch (e: any) {
        errors.push({ row: i + 1, reason: e?.message ? e.message.slice(0, 120) : "DB insert error" });
      }
    }

    res.status(201).json({ imported: inserted.length, errors, total: rows.length });
  } catch (err) {
    req.log.error({ err }, "Bulk import error");
    res.status(500).json({ error: "ServerError" });
  }
});

// ─── PRODUCT STATS ───────────────────────────────────────────
// GET /api/store/stats
router.get("/stats", async (req: AuthRequest, res) => {
  try {
    const store = await getOwnerStore(req.user!.userId, req.user!.role);
    if (!store) { res.status(404).json({ error: "NoStore" }); return; }

    const [totalResult, activeResult, inactiveResult, outOfStockResult, allForCalc] = await Promise.all([
      db.select({ count: count() }).from(productsTable).where(eq(productsTable.storeId, store.id)),
      db.select({ count: count() }).from(productsTable).where(and(eq(productsTable.storeId, store.id), eq(productsTable.isActive, true))),
      db.select({ count: count() }).from(productsTable).where(and(eq(productsTable.storeId, store.id), eq(productsTable.isActive, false))),
      db.select({ count: count() }).from(productsTable).where(and(eq(productsTable.storeId, store.id), eq(productsTable.stockQty, 0))),
      db.select({ stockQty: productsTable.stockQty, lowStockThreshold: productsTable.lowStockThreshold, price: productsTable.price })
        .from(productsTable).where(eq(productsTable.storeId, store.id)),
    ]);

    const lowStock = allForCalc.filter(p =>
      Number(p.stockQty) > 0 && Number(p.stockQty) <= (Number(p.lowStockThreshold) || 5)
    ).length;
    const totalInventoryValue = allForCalc.reduce(
      (sum, p) => sum + Number(p.price) * Number(p.stockQty), 0
    );

    res.json({
      totalProducts: totalResult[0]?.count ?? 0,
      activeProducts: activeResult[0]?.count ?? 0,
      inactiveProducts: inactiveResult[0]?.count ?? 0,
      outOfStock: outOfStockResult[0]?.count ?? 0,
      lowStock,
      totalInventoryValue,
    });
  } catch (err) {
    req.log.error({ err }, "Stats error");
    res.status(500).json({ error: "ServerError" });
  }
});

// POST /api/store/products/bulk-action
router.post("/products/bulk-action", async (req: AuthRequest, res) => {
  try {
    const store = await getOwnerStore(req.user!.userId, req.user!.role);
    if (!store) { res.status(404).json({ error: "NoStore" }); return; }

    const { action, productIds } = req.body;
    if (!action || !Array.isArray(productIds) || productIds.length === 0) {
      res.status(400).json({ error: "ValidationError", message: "action and productIds are required" });
      return;
    }
    const validActions = ["activate", "deactivate", "delete", "mark_out_of_stock", "mark_in_stock"];
    if (!validActions.includes(action)) {
      res.status(400).json({ error: "ValidationError", message: `Invalid action. Valid: ${validActions.join(", ")}` });
      return;
    }

    // Verify all productIds belong to this store
    const ownedProducts = await db.select({ id: productsTable.id })
      .from(productsTable)
      .where(and(eq(productsTable.storeId, store.id), inArray(productsTable.id, productIds)));
    const ownedIds = ownedProducts.map(p => p.id);
    if (ownedIds.length === 0) {
      res.status(403).json({ error: "NotAuthorized", message: "No products found for this store" });
      return;
    }

    const updateData: Record<string, any> = { updatedAt: new Date() };
    if (action === "activate") updateData.isActive = true;
    else if (action === "deactivate" || action === "delete") updateData.isActive = false;
    else if (action === "mark_out_of_stock") updateData.stockQty = 0;
    else if (action === "mark_in_stock") updateData.stockQty = 999;

    await db.update(productsTable)
      .set(updateData)
      .where(and(eq(productsTable.storeId, store.id), inArray(productsTable.id, ownedIds)));

    const actionLabels: Record<string, string> = {
      activate: "activated", deactivate: "deactivated", delete: "deactivated (soft)",
      mark_out_of_stock: "marked as out of stock", mark_in_stock: "marked as in stock",
    };
    res.json({
      success: true,
      message: `${ownedIds.length} product${ownedIds.length !== 1 ? "s" : ""} ${actionLabels[action]} successfully`,
      affectedCount: ownedIds.length,
    });
  } catch (err) {
    req.log.error({ err }, "Bulk action error");
    res.status(500).json({ error: "ServerError" });
  }
});

// GET /api/store/products/export?format=csv
router.get("/products/export", async (req: AuthRequest, res) => {
  try {
    const store = await getOwnerStore(req.user!.userId, req.user!.role);
    if (!store) { res.status(404).json({ error: "NoStore" }); return; }

    const products = await db.select()
      .from(productsTable)
      .where(eq(productsTable.storeId, store.id))
      .orderBy(desc(productsTable.createdAt));

    const headers = ["Product ID","Product Name","Category","Type","Price","Sale Price","Stock Quantity","Low Stock Threshold","Status","SKU","Unit","Halal Certified","Featured","Approval Status","Created Date","Last Updated"];
    const rows = products.map(p => [
      p.id,
      p.name,
      p.category,
      p.productType,
      Number(p.price).toFixed(2),
      p.comparePrice ? Number(p.comparePrice).toFixed(2) : "",
      p.stockQty,
      p.lowStockThreshold,
      p.isActive ? "Active" : "Inactive",
      p.sku || "",
      p.unit,
      p.isHalalCertified ? "Yes" : "No",
      p.isFeatured ? "Yes" : "No",
      p.approvalStatus || "pending",
      p.createdAt ? new Date(p.createdAt).toISOString().split("T")[0] : "",
      p.updatedAt ? new Date(p.updatedAt).toISOString().split("T")[0] : "",
    ]);

    const csvLines = [
      headers.join(","),
      ...rows.map(row => row.map(val => {
        const s = String(val ?? "").replace(/"/g, '""');
        return s.includes(",") || s.includes('"') || s.includes("\n") ? `"${s}"` : s;
      }).join(",")),
    ].join("\n");

    const storeName = store.name.replace(/[^a-zA-Z0-9]/g, "-").slice(0, 30);
    const date = new Date().toISOString().split("T")[0];
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="products-${storeName}-${date}.csv"`);
    res.send(csvLines);
  } catch (err) {
    req.log.error({ err }, "Export error");
    res.status(500).json({ error: "ServerError" });
  }
});

// ─── ANALYTICS ───────────────────────────────────────────────
// GET /api/store/analytics?period=week
router.get("/analytics", async (req: AuthRequest, res) => {
  try {
    const store = await getOwnerStore(req.user!.userId, req.user!.role);
    if (!store) { res.status(404).json({ error: "NoStore" }); return; }

    const { period = "week" } = req.query as Record<string, string>;
    const now = new Date();
    let startDate = new Date();
    if (period === "today") { startDate.setHours(0, 0, 0, 0); }
    else if (period === "week") { startDate.setDate(now.getDate() - 7); }
    else if (period === "month") { startDate.setDate(now.getDate() - 30); }
    else { startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); }

    const orders = await db.select().from(ordersTable).where(and(eq(ordersTable.storeId, store.id), gte(ordersTable.createdAt, startDate)));

    // Revenue over time (daily)
    const revenueByDay: Record<string, number> = {};
    const ordersByDay: Record<string, number> = {};
    const orderTypeBreakdown: Record<string, number> = {};
    let totalRevenue = 0;
    let totalOrders = orders.length;
    let completedCount = 0;
    let cancelledCount = 0;

    for (const order of orders) {
      const day = order.createdAt.toISOString().split("T")[0];
      const amount = Number(order.finalTotal || order.estimatedTotal || 0);
      revenueByDay[day] = (revenueByDay[day] || 0) + amount;
      ordersByDay[day] = (ordersByDay[day] || 0) + 1;
      orderTypeBreakdown[order.orderType] = (orderTypeBreakdown[order.orderType] || 0) + 1;
      if (order.status === "COMPLETED") { totalRevenue += amount; completedCount++; }
      if (order.status === "CANCELLED") cancelledCount++;
    }

    const revenueChart = Object.entries(revenueByDay).sort(([a], [b]) => a.localeCompare(b)).map(([date, revenue]) => ({ date, revenue: Number(revenue.toFixed(2)) }));
    const ordersChart = Object.entries(ordersByDay).sort(([a], [b]) => a.localeCompare(b)).map(([date, count]) => ({ date, count }));
    const orderTypes = Object.entries(orderTypeBreakdown).map(([name, value]) => ({ name: name.replace(/_/g, " "), value }));

    // Top products from order items
    const orderIds = orders.map(o => o.id);
    const topProducts: Array<{ name: string; sales: number }> = [];
    if (orderIds.length > 0) {
      const items = await db.select().from(orderItemsTable).where(inArray(orderItemsTable.orderId, orderIds));
      const productSales: Record<string, { name: string; count: number }> = {};
      for (const item of items) {
        if (!productSales[item.productId]) productSales[item.productId] = { name: item.name, count: 0 };
        productSales[item.productId].count += item.quantity;
      }
      topProducts.push(...Object.values(productSales).sort((a, b) => b.count - a.count).slice(0, 10).map(p => ({ name: p.name, sales: p.count })));
    }

    const uniqueCustomers = new Set(orders.map(o => o.customerId)).size;
    const avgOrderValue = completedCount > 0 ? totalRevenue / completedCount : 0;

    res.json({
      period, totalRevenue: Number(totalRevenue.toFixed(2)), totalOrders, completedCount, cancelledCount,
      avgOrderValue: Number(avgOrderValue.toFixed(2)), uniqueCustomers,
      revenueChart, ordersChart, orderTypes, topProducts,
      avgPrepTime: store.avgPrepTimeMinutes ?? 0,
      rating: store.rating ?? 0,
    });
  } catch (err) {
    req.log.error({ err }, "Analytics error");
    res.status(500).json({ error: "ServerError" });
  }
});

// GET /api/store/analytics/peak-hours
router.get("/analytics/peak-hours", async (req: AuthRequest, res) => {
  try {
    const store = await getOwnerStore(req.user!.userId, req.user!.role);
    if (!store) { res.status(404).json({ error: "NoStore" }); return; }

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 90); // Last 90 days

    const orders = await db.select({ createdAt: ordersTable.createdAt })
      .from(ordersTable)
      .where(and(eq(ordersTable.storeId, store.id), gte(ordersTable.createdAt, startDate)));

    // Build 7x24 grid: [dayOfWeek][hour] = count
    const grid: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));
    for (const { createdAt } of orders) {
      const day = createdAt.getDay(); // 0=Sun, 6=Sat
      const hour = createdAt.getHours();
      grid[day][hour]++;
    }

    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const result = days.map((label, dayIdx) => ({
      day: label,
      hours: grid[dayIdx].map((count, hour) => ({ hour, count })),
    }));

    res.json({ grid: result, totalOrders: orders.length });
  } catch (err) {
    req.log.error({ err }, "Peak hours error");
    res.status(500).json({ error: "ServerError" });
  }
});

// ─── PAYOUTS ─────────────────────────────────────────────────
// GET /api/store/payouts
router.get("/payouts", async (req: AuthRequest, res) => {
  try {
    const store = await getOwnerStore(req.user!.userId, req.user!.role);
    if (!store) { res.status(404).json({ error: "NoStore" }); return; }

    const { period = "month" } = req.query as Record<string, string>;
    const now = new Date();
    let startDate = new Date();
    if (period === "week") { startDate.setDate(now.getDate() - 7); }
    else { startDate.setDate(now.getDate() - 30); }

    const orders = await db.select().from(ordersTable).where(and(eq(ordersTable.storeId, store.id), eq(ordersTable.status, "COMPLETED"), gte(ordersTable.createdAt, startDate)));

    const grossRevenue = orders.reduce((s, o) => s + Number(o.finalTotal || o.estimatedTotal || 0), 0);
    const commissionRate = 0.07;
    const commission = grossRevenue * commissionRate;
    const netPayout = grossRevenue - commission;

    // Simulate payout history (weekly batches)
    const payoutHistory = [
      { id: "1", period: "Mar 24 – Mar 30, 2025", grossRevenue: 1248.50, commission: 87.40, netPayout: 1161.10, status: "PAID", paidAt: "Apr 1, 2025" },
      { id: "2", period: "Mar 17 – Mar 23, 2025", grossRevenue: 986.75, commission: 69.07, netPayout: 917.68, status: "PAID", paidAt: "Mar 25, 2025" },
      { id: "3", period: "Mar 10 – Mar 16, 2025", grossRevenue: 1432.20, commission: 100.25, netPayout: 1331.95, status: "PAID", paidAt: "Mar 18, 2025" },
    ];

    res.json({
      period, grossRevenue: Number(grossRevenue.toFixed(2)), commission: Number(commission.toFixed(2)),
      netPayout: Number(netPayout.toFixed(2)), commissionRate: commissionRate * 100,
      ordersCount: orders.length, payoutSchedule: "weekly", payoutHistory,
    });
  } catch (err) {
    req.log.error({ err }, "Payouts error");
    res.status(500).json({ error: "ServerError" });
  }
});

// ─── SETTINGS ────────────────────────────────────────────────
// GET /api/store/settings
router.get("/settings", async (req: AuthRequest, res) => {
  try {
    const store = await getOwnerStore(req.user!.userId, req.user!.role);
    if (!store) { res.status(404).json({ error: "NoStore" }); return; }
    res.json(store);
  } catch (err) {
    req.log.error({ err }, "Get settings error");
    res.status(500).json({ error: "ServerError" });
  }
});

// PUT /api/store/settings
router.put("/settings", async (req: AuthRequest, res) => {
  try {
    const store = await getOwnerStore(req.user!.userId, req.user!.role);
    if (!store) { res.status(404).json({ error: "NoStore" }); return; }

    const { name, description, phone, email, address, city, province, isActive, pickupAvailable, curbsideAvailable, deliveryAvailable, deliveryFee, curbsideFee, minOrderAmount, avgPrepTimeMinutes, businessHours } = req.body;
    const updateData: any = { updatedAt: new Date() };
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (phone !== undefined) updateData.phone = phone;
    if (email !== undefined) updateData.email = email;
    if (address !== undefined) updateData.address = address;
    if (city !== undefined) updateData.city = city;
    if (province !== undefined) updateData.province = province;
    if (isActive !== undefined) updateData.isActive = isActive;
    if (pickupAvailable !== undefined) updateData.pickupAvailable = pickupAvailable;
    if (curbsideAvailable !== undefined) updateData.curbsideAvailable = curbsideAvailable;
    if (deliveryAvailable !== undefined) updateData.deliveryAvailable = deliveryAvailable;
    if (deliveryFee !== undefined) updateData.deliveryFee = parseFloat(deliveryFee) || 0;
    if (curbsideFee !== undefined) updateData.curbsideFee = parseFloat(curbsideFee) || 0;
    if (minOrderAmount !== undefined) updateData.minOrderAmount = parseFloat(minOrderAmount) || 0;
    if (avgPrepTimeMinutes !== undefined) updateData.avgPrepTimeMinutes = avgPrepTimeMinutes;
    if (businessHours !== undefined) updateData.businessHours = businessHours;

    const [updated] = await db.update(storesTable).set(updateData).where(eq(storesTable.id, store.id)).returning();
    res.json(updated);
  } catch (err) {
    req.log.error({ err }, "Update settings error");
    res.status(500).json({ error: "ServerError" });
  }
});

export default router;
