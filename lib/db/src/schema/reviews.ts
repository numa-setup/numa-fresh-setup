import { pgTable, text, boolean, integer, timestamp, real } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { storesTable } from "./stores";
import { ordersTable } from "./orders";

export const reviewsTable = pgTable("reviews", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull().references(() => usersTable.id),
  storeId: text("store_id").notNull().references(() => storesTable.id),
  orderId: text("order_id").notNull().unique().references(() => ordersTable.id),
  rating: integer("rating").notNull(),
  comment: text("comment"),
  reply: text("reply"),
  repliedAt: timestamp("replied_at", { withTimezone: true }),
  isPublic: boolean("is_public").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Review = typeof reviewsTable.$inferSelect;
