import { pgTable, serial, integer, text, numeric, boolean, timestamp } from "drizzle-orm/pg-core";
  import { createInsertSchema } from "drizzle-zod";
  import { z } from "zod/v4";
  import { usersTable } from "./users";

  export const savedAddressesTable = pgTable("saved_addresses", {
    id: serial("id").primaryKey(),
    userId: integer("user_id").notNull().references(() => usersTable.id),
    label: text("label").notNull(),
    address: text("address").notNull(),
    lat: numeric("lat", { precision: 10, scale: 7 }).notNull(),
    lng: numeric("lng", { precision: 10, scale: 7 }).notNull(),
    isDefault: boolean("is_default").notNull().default(false),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  });

  export const insertSavedAddressSchema = createInsertSchema(savedAddressesTable).omit({ id: true, createdAt: true });
  export type SavedAddress = typeof savedAddressesTable.$inferSelect;
  export type InsertSavedAddress = z.infer<typeof insertSavedAddressSchema>;
  