import { pgTable, serial, integer, text, numeric, timestamp } from "drizzle-orm/pg-core";
  import { createInsertSchema } from "drizzle-zod";
  import { z } from "zod/v4";
  import { usersTable } from "./users";

  export const subscriptionPaymentsTable = pgTable("subscription_payments", {
    id: serial("id").primaryKey(),
    userId: integer("user_id").notNull().references(() => usersTable.id),
    amount: numeric("amount", { precision: 10, scale: 2 }).notNull().default("80.00"),
    pixKey: text("pix_key").notNull(),
    proofDescription: text("proof_description"),
    status: text("status").notNull().default("pending"),
    confirmedBy: integer("confirmed_by"),
    confirmedAt: timestamp("confirmed_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  });

  export const insertSubscriptionPaymentSchema = createInsertSchema(subscriptionPaymentsTable).omit({ id: true, createdAt: true });
  export type SubscriptionPayment = typeof subscriptionPaymentsTable.$inferSelect;
  export type InsertSubscriptionPayment = z.infer<typeof insertSubscriptionPaymentSchema>;
  