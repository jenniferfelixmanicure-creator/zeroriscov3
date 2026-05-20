import { pgTable, serial, integer, text, boolean, timestamp, numeric } from "drizzle-orm/pg-core";
  import { createInsertSchema } from "drizzle-zod";
  import { z } from "zod/v4";

  export const usersTable = pgTable("users", {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    cpf: text("cpf").unique(),
    email: text("email"),
    phone: text("phone"),
    passwordHash: text("password_hash"),
    googleId: text("google_id"),
    appleId: text("apple_id"),
    refreshToken: text("refresh_token"),
    role: text("role").notNull().default("passenger"),
    avatarUrl: text("avatar_url"),
    fcmToken: text("fcm_token"),
    isActive: boolean("is_active").notNull().default(true),
    walletBalance: numeric("wallet_balance", { precision: 10, scale: 2 }).notNull().default("0.00"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  });

  // Referência circular — categoriesTable é importada pelo schema principal
  import { categoriesTable } from "./categories";

  export const driverProfilesTable = pgTable("driver_profiles", {
    id: serial("id").primaryKey(),
    userId: integer("user_id").references(() => usersTable.id),
    categoryId: integer("category_id").references(() => categoriesTable.id),
    vehicleModel: text("vehicle_model").notNull().default(""),
    vehiclePlate: text("vehicle_plate").notNull().default(""),
    isOnline: boolean("is_online").notNull().default(false),
    rating: numeric("rating", { precision: 3, scale: 2 }).notNull().default("5.00"),
    totalRides: integer("total_rides").notNull().default(0),
    totalTripsAccepted: integer("total_trips_accepted").notNull().default(0),
    totalTripsCancelled: integer("total_trips_cancelled").notNull().default(0),
    acceptanceRate: numeric("acceptance_rate", { precision: 5, scale: 2 }).notNull().default("100.00"),
    cancellationRate: numeric("cancellation_rate", { precision: 5, scale: 2 }).notNull().default("0.00"),
    lastKnownLat: numeric("last_known_lat", { precision: 10, scale: 7 }),
    lastKnownLng: numeric("last_known_lng", { precision: 10, scale: 7 }),
    lastLocationAt: timestamp("last_location_at"),
    subscriptionStatus: text("subscription_status").notNull().default("inactive"),
    subscriptionExpiresAt: timestamp("subscription_expires_at"),
    approvalStatus: text("approval_status").notNull().default("pending"),
    cnhUrl: text("cnh_url"),
    crlvUrl: text("crlv_url"),
    rejectionReason: text("rejection_reason"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  });

  export const notificationsTable = pgTable("notifications", {
    id: serial("id").primaryKey(),
    userId: integer("user_id").references(() => usersTable.id),
    title: text("title").notNull(),
    body: text("body").notNull(),
    type: text("type").notNull().default("general"),
    isRead: boolean("is_read").notNull().default(false),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  });

  export const insertUserSchema = createInsertSchema(usersTable).omit({ id: true, createdAt: true });
  export const insertDriverProfileSchema = createInsertSchema(driverProfilesTable).omit({ id: true, createdAt: true });
  export const insertNotificationSchema = createInsertSchema(notificationsTable).omit({ id: true, createdAt: true });

  export type User = typeof usersTable.$inferSelect;
  export type InsertUser = z.infer<typeof insertUserSchema>;
  export type DriverProfile = typeof driverProfilesTable.$inferSelect;
  export type Notification = typeof notificationsTable.$inferSelect;
  