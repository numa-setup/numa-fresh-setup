import { pgTable, text, boolean, integer, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const userRoleEnum = pgEnum("user_role", ["CUSTOMER", "STORE_OWNER", "STORE_STAFF", "ADMIN"]);
export const subscriptionPlanEnum = pgEnum("subscription_plan", ["FREE", "BASIC", "PREMIUM", "FAMILY"]);

export const usersTable = pgTable("users", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash"),
  googleId: text("google_id").unique(),
  role: userRoleEnum("role").notNull().default("CUSTOMER"),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  phone: text("phone"),
  phoneVerified: boolean("phone_verified").notNull().default(false),
  avatar: text("avatar"),
  preferredLanguage: text("preferred_language").notNull().default("en"),
  isVerified: boolean("is_verified").notNull().default(false),
  isActive: boolean("is_active").notNull().default(true),
  loyaltyPoints: integer("loyalty_points").notNull().default(0),
  doNotSell: boolean("do_not_sell").notNull().default(false),
  limitSensitiveData: boolean("limit_sensitive_data").notNull().default(false),
  expoPushToken: text("expo_push_token"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;
