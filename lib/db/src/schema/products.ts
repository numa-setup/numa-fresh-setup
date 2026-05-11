import { pgTable, text, boolean, real, integer, timestamp, json, pgEnum, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { storesTable } from "./stores";

export const productTypeEnum = pgEnum("product_type", ["PACKAGED", "FRESH_MEAT", "PRODUCE", "FROZEN", "SPICES", "BAKERY", "DAIRY", "BEVERAGES"]);
export const meatCutTypeEnum = pgEnum("meat_cut_type", ["WHOLE", "HALF", "QUARTER", "BONELESS", "BONE_IN", "CUBED", "GROUND", "CUSTOM"]);

export const productsTable = pgTable("products", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  storeId: text("store_id").notNull().references(() => storesTable.id),
  slug: text("slug").notNull(),
  name: text("name").notNull(),
  nameUrdu: text("name_urdu"),
  nameArabic: text("name_arabic"),
  description: text("description"),
  descriptionUrdu: text("description_urdu"),
  productType: productTypeEnum("product_type").notNull(),
  category: text("category").notNull(),
  subcategory: text("subcategory"),
  images: json("images").notNull().default([]).$type<string[]>(),
  price: real("price").notNull(),
  comparePrice: real("compare_price"),
  unit: text("unit").notNull(),
  stockQty: real("stock_qty").notNull(),
  lowStockThreshold: real("low_stock_threshold").notNull().default(5),
  barcode: text("barcode"),
  sku: text("sku"),
  isActive: boolean("is_active").notNull().default(true),
  isFeatured: boolean("is_featured").notNull().default(false),
  isHalalCertified: boolean("is_halal_certified").notNull().default(true),
  isFreshMeat: boolean("is_fresh_meat").notNull().default(false),
  meatAnimalType: text("meat_animal_type"),
  availableCuts: json("available_cuts").$type<string[]>(),
  estimatedWeightKg: real("estimated_weight_kg"),
  pricePerKg: real("price_per_kg"),
  nutritionJson: json("nutrition_json").$type<unknown>(),
  metaTitle: text("meta_title"),
  metaDescription: text("meta_description"),
  tags: json("tags").notNull().default([]).$type<string[]>(),
  freshnessLabel: text("freshness_label"),

  // ── New columns from spec ──────────────────────────────────
  shortDesc: text("short_desc"),
  discount: real("discount").default(0),
  certBadges: json("cert_badges").default([]).$type<string[]>(),
  productDetails: text("product_details"),
  ingredients: text("ingredients"),
  directions: text("directions"),
  sizes: json("sizes").$type<Array<{ label: string; price: number; stock?: number }>>(),
  categoryId: text("category_id"),
  certifiedFrom: text("certified_from"),
  expiryDate: text("expiry_date"),
  isApproved: boolean("is_approved").notNull().default(false),
  approvalStatus: text("approval_status").notNull().default("pending"),
  rejectionReason: text("rejection_reason"),
  sortOrder: integer("sort_order").notNull().default(0),

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("idx_products_store_id").on(t.storeId),
  index("idx_products_category").on(t.category),
  index("idx_products_is_active").on(t.isActive),
  index("idx_products_is_featured").on(t.isFeatured),
  index("idx_products_product_type").on(t.productType),
  index("idx_products_store_active").on(t.storeId, t.isActive),
  index("idx_products_store_cat_approved").on(t.storeId, t.categoryId, t.isApproved),
]);

export const insertProductSchema = createInsertSchema(productsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertProduct = z.infer<typeof insertProductSchema>;
export type Product = typeof productsTable.$inferSelect;
