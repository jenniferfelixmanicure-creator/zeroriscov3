import { pgTable, serial, integer, text, numeric, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const walletTransactionsTable = pgTable("wallet_transactions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  rideId: integer("ride_id"),
  type: text("type").notNull(), // credit | debit | withdrawal
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
  description: text("description").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertTransactionSchema = createInsertSchema(walletTransactionsTable).omit({ id: true, createdAt: true });
export type WalletTransaction = typeof walletTransactionsTable.$inferSelect;
export type InsertTransaction = z.infer<typeof insertTransactionSchema>;
