import { pgTable, text, boolean, real, integer, timestamp, json, pgEnum, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { storesTable } from "./stores";
import { productsTable } from "./products";
import { meatCutTypeEnum, productTypeEnum } from "./products";

export const orderStatusEnum = pgEnum("order_status", [
  "PENDING", "STORE_CONFIRMED", "IN_PREPARATION", "REPLACEMENT_HANDLING",
  "READY_FOR_PICKUP", "OUT_FOR_DELIVERY", "COMPLETED", "CANCELLED", "REFUNDED"
]);

export const orderTypeEnum = pgEnum("order_type", ["EXPRESS_PICKUP", "CURBSIDE_PICKUP", "STORE_DELIVERY"]);
export const substitutionPrefEnum = pgEnum("substitution_pref", ["NO_REPLACEMENT", "REPLACE_SIMILAR", "CHOOSE_SPECIFIC", "CONTACT_FIRST"]);

export const addressesTable = pgTable("addresses", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull().references(() => usersTable.id),
  label: text("label").notNull().default("Home"),
  fullName: text("full_name"),
  phone: text("phone"),
  line1: text("line1").notNull(),
  line2: text("line2"),
  city: text("city").notNull(),
  province: text("province").notNull(),
  postalCode: text("postal_code").notNull(),
  country: text("country").notNull().default("CA"),
  lat: real("lat"),
  lng: real("lng"),
  isDefault: boolean("is_default").notNull().default(false),
  instructions: text("instructions"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const pickupSlotsTable = pgTable("pickup_slots", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  storeId: text("store_id").notNull().references(() => storesTable.id),
  date: timestamp("date", { withTimezone: true }).notNull(),
  startTime: text("start_time").notNull(),
  endTime: text("end_time").notNull(),
  maxOrders: integer("max_orders").notNull(),
  bookedOrders: integer("booked_orders").notNull().default(0),
  isAvailable: boolean("is_available").notNull().default(true),
});

export const ordersTable = pgTable("orders", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  orderNumber: text("order_number").notNull().unique(),
  customerId: text("customer_id").notNull().references(() => usersTable.id),
  storeId: text("store_id").notNull().references(() => storesTable.id),
  addressId: text("address_id").references(() => addressesTable.id),
  pickupSlotId: text("pickup_slot_id").references(() => pickupSlotsTable.id),
  status: orderStatusEnum("status").notNull().default("PENDING"),
  orderType: orderTypeEnum("order_type").notNull(),
  deliveryMethod: text("delivery_method"),
  paymentMethod: text("payment_method"),
  subtotal: real("subtotal").notNull(),
  convenienceFee: real("convenience_fee").notNull().default(0),
  deliveryFee: real("delivery_fee").notNull().default(0),
  curbsideFee: real("curbside_fee").notNull().default(0),
  discount: real("discount").notNull().default(0),
  tip: real("tip").notNull().default(0),
  estimatedTotal: real("estimated_total").notNull(),
  finalTotal: real("final_total"),
  promoCode: text("promo_code"),
  promoDiscount: real("promo_discount").notNull().default(0),
  loyaltyPointsUsed: integer("loyalty_points_used").notNull().default(0),
  loyaltyDiscount: real("loyalty_discount").notNull().default(0),
  paymentIntentId: text("payment_intent_id"),
  stripePaymentIntentId: text("stripe_payment_intent_id"),
  paymentStatus: text("payment_status").notNull().default("pending"),
  deliveryAddress: json("delivery_address").$type<{
    street?: string;
    city?: string;
    state?: string;
    zip?: string;
  }>(),
  isFastDelivery: boolean("is_fast_delivery").notNull().default(false),
  fastDeliveryCharge: real("fast_delivery_charge").notNull().default(0),
  itemsTotal: real("items_total"),
  totalAmount: real("total_amount"),
  stripeChargeId: text("stripe_charge_id"),
  preAuthAmount: real("pre_auth_amount"),
  finalCaptured: boolean("final_captured").notNull().default(false),
  vehicleInfo: json("vehicle_info").$type<unknown>(),
  pickupQrCode: text("pickup_qr_code"),
  pickupConfirmedAt: timestamp("pickup_confirmed_at", { withTimezone: true }),
  specialInstructions: text("special_instructions"),
  customerRating: integer("customer_rating"),
  storeRating: integer("store_rating"),
  customerReview: text("customer_review"),
  cancelReason: text("cancel_reason"),
  refundAmount: real("refund_amount"),
  refundedAt: timestamp("refunded_at", { withTimezone: true }),
  estimatedReadyAt: timestamp("estimated_ready_at", { withTimezone: true }),
  readyAt: timestamp("ready_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("idx_orders_customer_id").on(t.customerId),
  index("idx_orders_store_id").on(t.storeId),
  index("idx_orders_status").on(t.status),
  index("idx_orders_payment_status").on(t.paymentStatus),
  index("idx_orders_created_at").on(t.createdAt),
  index("idx_orders_customer_store").on(t.customerId, t.storeId),
]);

export const orderItemsTable = pgTable("order_items", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  orderId: text("order_id").notNull().references(() => ordersTable.id),
  productId: text("product_id").notNull().references(() => productsTable.id),
  name: text("name").notNull(),
  productType: productTypeEnum("product_type").notNull(),
  quantity: real("quantity").notNull(),
  unit: text("unit").notNull(),
  unitPrice: real("unit_price").notNull(),
  totalPrice: real("total_price").notNull(),
  isFreshMeat: boolean("is_fresh_meat").notNull().default(false),
  meatCutType: meatCutTypeEnum("meat_cut_type"),
  meatCutInstructions: text("meat_cut_instructions"),
  meatMarination: text("meat_marination"),
  meatPackagingPref: text("meat_packaging_pref"),
  estimatedWeightKg: real("estimated_weight_kg"),
  finalWeightKg: real("final_weight_kg"),
  finalPrice: real("final_price"),
  substitutionPref: substitutionPrefEnum("substitution_pref").notNull().default("NO_REPLACEMENT"),
  substituteProductId: text("substitute_product_id").references(() => productsTable.id),
  substitutionStatus: text("substitution_status"),
  substitutionNote: text("substitution_note"),
  itemStatus: text("item_status").notNull().default("pending"),
  isOutOfStock: boolean("is_out_of_stock").notNull().default(false),
  staffNote: text("staff_note"),
  // Round 10 / Fix #4 — generic per-item note from customer to shopper
  // (works for any product type, not just meat).
  customerNote: text("customer_note"),
});

export const orderStatusHistoryTable = pgTable("order_status_history", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  orderId: text("order_id").notNull().references(() => ordersTable.id),
  status: orderStatusEnum("status").notNull(),
  note: text("note"),
  createdBy: text("created_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const orderMessagesTable = pgTable("order_messages", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  orderId: text("order_id").notNull().references(() => ordersTable.id),
  senderId: text("sender_id").notNull(),
  senderRole: text("sender_role").notNull(),
  content: text("content").notNull(),
  isRead: boolean("is_read").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertOrderSchema = createInsertSchema(ordersTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertOrder = z.infer<typeof insertOrderSchema>;
export type Order = typeof ordersTable.$inferSelect;
