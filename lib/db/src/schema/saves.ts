import { pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { productsTable } from "./products";

/**
 * Per-user saved-products list ("Save List" / wishlist).
 * Round 10 / Fix #6.
 *
 * One row per (user, product). The unique index lets POST /api/saves act as
 * an idempotent "save" without needing to read-then-write.
 */
export const savedProductsTable = pgTable(
  "saved_products",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
    productId: text("product_id").notNull().references(() => productsTable.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  table => ({
    userProductUq: uniqueIndex("saved_products_user_product_uq").on(table.userId, table.productId),
  })
);

export type SavedProduct = typeof savedProductsTable.$inferSelect;
