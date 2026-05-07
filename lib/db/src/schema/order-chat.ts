import { pgTable, serial, text, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { ordersTable } from "./orders";
import { usersTable } from "./users";

export const senderRoleEnum = pgEnum("chat_sender_role", ["CUSTOMER", "STORE_OWNER", "ADMIN", "SYSTEM"]);

export const orderChatMessagesTable = pgTable("order_chat_messages", {
  id: serial("id").primaryKey(),
  orderId: text("order_id").notNull().references(() => ordersTable.id, { onDelete: "cascade" }),
  senderId: text("sender_id").references(() => usersTable.id, { onDelete: "set null" }),
  senderRole: senderRoleEnum("sender_role").notNull().default("CUSTOMER"),
  senderName: text("sender_name").notNull().default("User"),
  content: text("content").notNull(),
  messageType: text("message_type").notNull().default("text"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export type OrderChatMessage = typeof orderChatMessagesTable.$inferSelect;
export type InsertOrderChatMessage = typeof orderChatMessagesTable.$inferInsert;
