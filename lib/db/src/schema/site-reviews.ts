import { pgTable, text, boolean, integer, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { storesTable } from "./stores";

export const siteReviewsTable = pgTable("site_reviews", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  targetType: text("target_type").notNull().$type<"platform" | "store" | "product">(),
  storeId: text("store_id").references(() => storesTable.id, { onDelete: "cascade" }),
  productSlug: text("product_slug"),
  authorId: text("author_id").references(() => usersTable.id, { onDelete: "set null" }),
  authorName: text("author_name").notNull(),
  rating: integer("rating").notNull(),
  comment: text("comment"),
  isApproved: boolean("is_approved").notNull().default(false),
  isFeatured: boolean("is_featured").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type SiteReview = typeof siteReviewsTable.$inferSelect;
