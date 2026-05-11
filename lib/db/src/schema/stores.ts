import { pgTable, text, boolean, integer, real, timestamp, json, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { usersTable } from "./users";

export const storesTable = pgTable("stores", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  ownerId: text("owner_id").notNull().references(() => usersTable.id),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  nameUrdu: text("name_urdu"),
  nameArabic: text("name_arabic"),
  description: text("description"),
  logo: text("logo"),
  banner: text("banner"),
  phone: text("phone").notNull(),
  email: text("email").notNull(),
  address: text("address").notNull(),
  city: text("city").notNull(),
  province: text("province").notNull(),
  postalCode: text("postal_code").notNull(),
  lat: real("lat").notNull(),
  lng: real("lng").notNull(),
  isActive: boolean("is_active").notNull().default(false),
  isApproved: boolean("is_approved").notNull().default(false),
  isHalalCertified: boolean("is_halal_certified").notNull().default(false),
  halalCertNumber: text("halal_cert_number"),
  halalCertExpiry: timestamp("halal_cert_expiry", { withTimezone: true }),
  halalCertDoc: text("halal_cert_doc"),
  halalCertBody: text("halal_cert_body"),
  commissionRate: real("commission_rate").notNull().default(7.0),
  convenienceFee: real("convenience_fee").notNull().default(2.99),
  curbsideFee: real("curbside_fee").notNull().default(0.0),
  minOrderAmount: real("min_order_amount").notNull().default(0.0),
  avgPrepTimeMinutes: integer("avg_prep_time_minutes").notNull().default(30),
  deliveryAvailable: boolean("delivery_available").notNull().default(false),
  deliveryFee: real("delivery_fee"),
  deliveryRadiusKm: real("delivery_radius_km"),
  pickupAvailable: boolean("pickup_available").notNull().default(true),
  curbsideAvailable: boolean("curbside_available").notNull().default(false),
  maxOrdersPerSlot: integer("max_orders_per_slot").notNull().default(10),
  slotDurationMinutes: integer("slot_duration_minutes").notNull().default(30),
  rating: real("rating").notNull().default(0.0),
  totalRatings: integer("total_ratings").notNull().default(0),
  openingHoursJson: json("opening_hours_json").notNull().$type<Record<string, { open: string; close: string; closed?: boolean }>>(),
  deliveryZonesJson: json("delivery_zones_json").$type<unknown>(),
  bankingInfo: json("banking_info").$type<unknown>(),
  stripeAccountId: text("stripe_account_id"),
  isMasjidAffiliated: boolean("is_masjid_affiliated").notNull().default(false),
  masjidName: text("masjid_name"),

  // ── New columns from spec ──────────────────────────────────
  branchName: text("branch_name"),
  tagline: text("tagline"),
  cardImage: text("card_image"),
  amenityTags: json("amenity_tags").default([]).$type<string[]>(),

  // Services
  servicesOffered: json("services_offered").default([]).$type<string[]>(),

  // Premium Fresh Section
  premiumFreshEnabled: boolean("premium_fresh_enabled").notNull().default(true),
  premiumFreshBadgeTitle: text("premium_fresh_badge_title"),
  premiumFreshHeading: text("premium_fresh_heading"),
  premiumFreshDesc: text("premium_fresh_desc"),
  premiumFreshCutTags: json("premium_fresh_cut_tags").default([]).$type<string[]>(),
  premiumFreshBullet1: text("premium_fresh_bullet1"),
  premiumFreshBullet2: text("premium_fresh_bullet2"),
  premiumFreshBullet3: text("premium_fresh_bullet3"),
  premiumFreshImages: json("premium_fresh_images").default([]).$type<Array<{ src: string; tag: string; label: string; price: string }>>(),
  premiumFreshButtonText: text("premium_fresh_button_text"),
  premiumFreshButtonLink: text("premium_fresh_button_link"),

  // Visibility & Status Controls
  isActiveManual: boolean("is_active_manual").notNull().default(true),
  showOnWebsite: boolean("show_on_website").notNull().default(false),
  isCurrentlyOpen: boolean("is_currently_open").notNull().default(false),
  storeStatus: text("store_status").notNull().default("pending"),
  rejectionReason: text("rejection_reason"),

  // Google maps
  googleMapsLink: text("google_maps_link"),

  // Store-defined categories (shown in "Browse by Category" section)
  storeCategories: json("store_categories").default([]).$type<Array<{ name: string; emoji?: string; imageUrl?: string }>>(),

  // Onboarding
  onboardingCompleted: boolean("onboarding_completed").notNull().default(false),

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("idx_stores_owner_id").on(t.ownerId),
  index("idx_stores_city").on(t.city),
  index("idx_stores_active_approved").on(t.isActive, t.isApproved),
  index("idx_stores_slug").on(t.slug),
  index("idx_stores_status_visible").on(t.storeStatus, t.showOnWebsite),
]);

export const storeStaffTable = pgTable("store_staff", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  storeId: text("store_id").notNull().references(() => storesTable.id),
  userId: text("user_id").notNull().references(() => usersTable.id),
  role: text("role").notNull().default("staff"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertStoreSchema = createInsertSchema(storesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertStore = z.infer<typeof insertStoreSchema>;
export type Store = typeof storesTable.$inferSelect;
