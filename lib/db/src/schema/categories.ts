import { pgTable, serial, text, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const categoriesTable = pgTable("categories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  icon: text("icon").notNull().default("car"),
  baseFare: numeric("base_fare", { precision: 10, scale: 2 }).notNull().default("3.00"),
  pricePerKm: numeric("price_per_km", { precision: 10, scale: 2 }).notNull().default("1.50"),
  pricePerMinute: numeric("price_per_minute", { precision: 10, scale: 2 }).notNull().default("0.30"),
  minFare: numeric("min_fare", { precision: 10, scale: 2 }).notNull().default("6.00"),
  multiplier: numeric("multiplier", { precision: 4, scale: 2 }).notNull().default("1.00"),
});

export const insertCategorySchema = createInsertSchema(categoriesTable).omit({ id: true });
export type Category = typeof categoriesTable.$inferSelect;
export type InsertCategory = z.infer<typeof insertCategorySchema>;
