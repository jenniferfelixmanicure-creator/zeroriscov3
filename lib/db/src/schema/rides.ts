import { pgTable, serial, integer, text, numeric, timestamp } from "drizzle-orm/pg-core";
  import { createInsertSchema } from "drizzle-zod";
  import { z } from "zod/v4";
  import { usersTable } from "./users";
  import { categoriesTable } from "./categories";

  export const ridesTable = pgTable("rides", {
    id: serial("id").primaryKey(),
    passengerId: integer("passenger_id").notNull().references(() => usersTable.id),
    driverId: integer("driver_id").references(() => usersTable.id),
    categoryId: integer("category_id").notNull().references(() => categoriesTable.id),
    status: text("status").notNull().default("searching"),
    originAddress: text("origin_address").notNull(),
    originLat: numeric("origin_lat", { precision: 10, scale: 7 }).notNull(),
    originLng: numeric("origin_lng", { precision: 10, scale: 7 }).notNull(),
    destinationAddress: text("destination_address").notNull(),
    destinationLat: numeric("destination_lat", { precision: 10, scale: 7 }).notNull(),
    destinationLng: numeric("destination_lng", { precision: 10, scale: 7 }).notNull(),
    estimatedDistance: numeric("estimated_distance", { precision: 8, scale: 2 }).notNull(),
    estimatedDuration: integer("estimated_duration").notNull(),
    estimatedFare: numeric("estimated_fare", { precision: 10, scale: 2 }).notNull(),
    finalFare: numeric("final_fare", { precision: 10, scale: 2 }),
    surgePriceMultiplier: numeric("surge_price_multiplier", { precision: 4, scale: 2 }).notNull().default("1.00"),
    polyline: text("polyline"),
    verificationPin: text("verification_pin"),
    tripShareToken: text("trip_share_token"),
    scheduledFor: timestamp("scheduled_for"),
    startedAt: timestamp("started_at"),
    completedAt: timestamp("completed_at"),
    cancellationReason: text("cancellation_reason"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  });

  export const insertRideSchema = createInsertSchema(ridesTable).omit({ id: true, createdAt: true });
  export type Ride = typeof ridesTable.$inferSelect;
  export type InsertRide = z.infer<typeof insertRideSchema>;
  