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
  role: text("role").notNull().default("passenger"), // passenger | driver | admin
  avatarUrl: text("avatar_url"),
  isActive: boolean("is_active").notNull().default(true),
  walletBalance: numeric("wallet_balance", { precision: 10, scale: 2 }).notNull().default("0.00"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const driverProfilesTable = pgTable("driver_profiles", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => usersTable.id),
  categoryId: integer("category_id").references(() => categoriesTable.id),
  vehicleModel: text("vehicle_model").notNull().default(""),
  vehiclePlate: text("vehicle_plate").notNull().default(""),
  isOnline: boolean("is_online").notNull().default(false),
  rating: numeric("rating", { precision: 3, scale: 2 }).notNull().default("5.00"),
  totalRides: integer("total_rides").notNull().default(0),
  balance: numeric("balance", { precision: 10, scale: 2 }).notNull().default("0.00"),
  approvalStatus: text("approval_status").notNull().default("pending"), // pending | approved | rejected
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
