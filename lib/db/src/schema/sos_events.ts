import { pgTable, serial, integer, text, numeric, timestamp } from "drizzle-orm/pg-core";
  import { createInsertSchema } from "drizzle-zod";
  import { z } from "zod/v4";
  import { usersTable } from "./users";

  export const sosEventsTable = pgTable("sos_events", {
    id: serial("id").primaryKey(),
    userId: integer("user_id").notNull().references(() => usersTable.id),
    rideId: integer("ride_id"),
    lat: numeric("lat", { precision: 10, scale: 7 }),
    lng: numeric("lng", { precision: 10, scale: 7 }),
    message: text("message"),
    status: text("status").notNull().default("open"),
    resolvedAt: timestamp("resolved_at"),
    resolvedBy: integer("resolved_by"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  });

  export const insertSosEventSchema = createInsertSchema(sosEventsTable).omit({ id: true, createdAt: true });
  export type SosEvent = typeof sosEventsTable.$inferSelect;
  export type InsertSosEvent = z.infer<typeof insertSosEventSchema>;
  