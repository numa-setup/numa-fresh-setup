import { pgTable, text, boolean, real, integer, timestamp, json, pgEnum } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { storesTable } from "./stores";

export const subscriptionPlanEnum2 = pgEnum("subscription_plan_v2", ["FREE", "BASIC", "PREMIUM", "FAMILY"]);

export const subscriptionsTable = pgTable("subscriptions", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull().unique().references(() => usersTable.id),
  plan: text("plan").notNull().default("FREE"),
  status: text("status").notNull().default("active"),
  price: real("price").notNull().default(0),
  billingCycle: text("billing_cycle").notNull().default("monthly"),
  nextBillingDate: timestamp("next_billing_date", { withTimezone: true }),
  stripeSubscriptionId: text("stripe_subscription_id"),
  cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
});

export const loyaltyTransactionsTable = pgTable("loyalty_transactions", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull().references(() => usersTable.id),
  points: integer("points").notNull(),
  type: text("type").notNull(),
  orderId: text("order_id"),
  description: text("description").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const promoCodesTable = pgTable("promo_codes", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  code: text("code").notNull().unique(),
  discountType: text("discount_type").notNull(),
  discountValue: real("discount_value").notNull(),
  minOrder: real("min_order").notNull().default(0),
  maxUses: integer("max_uses"),
  usedCount: integer("used_count").notNull().default(0),
  storeId: text("store_id"),
  expiryDate: timestamp("expiry_date", { withTimezone: true }),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const promotionsTable = pgTable("promotions", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  storeId: text("store_id").notNull().references(() => storesTable.id),
  name: text("name").notNull(),
  type: text("type").notNull(),
  discountValue: real("discount_value").notNull(),
  productIds: json("product_ids").notNull().default([]).$type<string[]>(),
  startDate: timestamp("start_date", { withTimezone: true }).notNull(),
  endDate: timestamp("end_date", { withTimezone: true }).notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const notificationsTable = pgTable("notifications", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull().references(() => usersTable.id),
  orderId: text("order_id"),
  type: text("type").notNull(),
  title: text("title").notNull(),
  titleUrdu: text("title_urdu"),
  body: text("body").notNull(),
  bodyUrdu: text("body_urdu"),
  dataJson: json("data_json").$type<unknown>(),
  isRead: boolean("is_read").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const storeAnalyticsTable = pgTable("store_analytics", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  storeId: text("store_id").notNull().references(() => storesTable.id),
  date: timestamp("date", { withTimezone: true }).notNull(),
  ordersCount: integer("orders_count").notNull().default(0),
  revenue: real("revenue").notNull().default(0),
  commission: real("commission").notNull().default(0),
  avgPrepTime: integer("avg_prep_time"),
  topProductsJson: json("top_products_json").$type<unknown>(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const storePayoutsTable = pgTable("store_payouts", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  storeId: text("store_id").notNull().references(() => storesTable.id),
  period: text("period").notNull(),
  grossRevenue: real("gross_revenue").notNull(),
  commission: real("commission").notNull(),
  netAmount: real("net_amount").notNull(),
  status: text("status").notNull().default("pending"),
  stripeTransferId: text("stripe_transfer_id"),
  processedAt: timestamp("processed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const supportTicketsTable = pgTable("support_tickets", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull().references(() => usersTable.id),
  orderId: text("order_id"),
  subject: text("subject").notNull(),
  status: text("status").notNull().default("open"),
  priority: text("priority").notNull().default("normal"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
});

export const supportMessagesTable = pgTable("support_messages", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  ticketId: text("ticket_id").notNull().references(() => supportTicketsTable.id),
  senderId: text("sender_id").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const auditLogsTable = pgTable("audit_logs", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  adminId: text("admin_id").notNull(),
  action: text("action").notNull(),
  targetType: text("target_type").notNull(),
  targetId: text("target_id").notNull(),
  oldValueJson: json("old_value_json").$type<unknown>(),
  newValueJson: json("new_value_json").$type<unknown>(),
  ipAddress: text("ip_address"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const siteContentTable = pgTable("site_content", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  key: text("key").notNull().unique(),
  valueJson: json("value_json").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
