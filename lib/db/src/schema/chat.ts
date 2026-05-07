import { pgTable, text, boolean, timestamp, json, index, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { storesTable } from "./stores";

// Full-featured chat conversations (admin ↔ store, admin ↔ customer, store ↔ customer)
export const chatConversationsTable = pgTable("chat_conversations", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  type: text("type").notNull(),
  // 'admin_store' | 'admin_customer' | 'store_customer'
  adminId: text("admin_id").references(() => usersTable.id, { onDelete: "set null" }),
  storeId: text("store_id").references(() => storesTable.id, { onDelete: "cascade" }),
  customerId: text("customer_id").references(() => usersTable.id, { onDelete: "set null" }),
  storeOwnerId: text("store_owner_id").references(() => usersTable.id, { onDelete: "set null" }),
  lastMessageAt: timestamp("last_message_at", { withTimezone: true }).notNull().defaultNow(),
  lastMessageText: text("last_message_text"),
  isArchivedAdmin: boolean("is_archived_admin").notNull().default(false),
  isArchivedStore: boolean("is_archived_store").notNull().default(false),
  isArchivedCustomer: boolean("is_archived_customer").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("idx_chat_conv_store").on(t.storeId, t.lastMessageAt),
  index("idx_chat_conv_customer").on(t.customerId, t.lastMessageAt),
  index("idx_chat_conv_admin").on(t.adminId, t.lastMessageAt),
]);

// Messages in chat conversations
export const chatMessagesTable = pgTable("chat_messages", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  conversationId: text("conversation_id").notNull().references(() => chatConversationsTable.id, { onDelete: "cascade" }),
  senderId: text("sender_id").references(() => usersTable.id, { onDelete: "set null" }),
  senderRole: text("sender_role").notNull(),
  // 'admin' | 'store_owner' | 'customer'
  content: text("content"),
  messageType: text("message_type").notNull().default("text"),
  // 'text' | 'image' | 'file' | 'order_card' | 'product_card' | 'system'
  attachmentUrl: text("attachment_url"),
  attachmentName: text("attachment_name"),
  metadata: json("metadata").$type<Record<string, unknown>>(),
  isRead: boolean("is_read").notNull().default(false),
  readAt: timestamp("read_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("idx_chat_messages_conv").on(t.conversationId, t.createdAt),
]);

// Per-user read receipts
export const chatMessageReadsTable = pgTable("chat_message_reads", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  messageId: text("message_id").notNull().references(() => chatMessagesTable.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  readAt: timestamp("read_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  unique("uq_message_read").on(t.messageId, t.userId),
]);

export const insertChatConversationSchema = createInsertSchema(chatConversationsTable).omit({ id: true, createdAt: true, lastMessageAt: true });
export type InsertChatConversation = z.infer<typeof insertChatConversationSchema>;
export type ChatConversation = typeof chatConversationsTable.$inferSelect;

export const insertChatMessageSchema = createInsertSchema(chatMessagesTable).omit({ id: true, createdAt: true });
export type InsertChatMessage = z.infer<typeof insertChatMessageSchema>;
export type ChatMessage = typeof chatMessagesTable.$inferSelect;
