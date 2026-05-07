import { pgTable, text, jsonb, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const mealPlansTable = pgTable("meal_plans", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  planType: text("plan_type").notNull().default("weekly"),
  planData: jsonb("plan_data").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type MealPlan = typeof mealPlansTable.$inferSelect;
export type InsertMealPlan = typeof mealPlansTable.$inferInsert;
