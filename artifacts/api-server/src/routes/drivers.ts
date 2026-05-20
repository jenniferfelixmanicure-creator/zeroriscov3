import { Router, type IRouter } from "express";
  import { eq } from "drizzle-orm";
  import { db } from "@workspace/db";
  import { driverProfilesTable, usersTable, walletTransactionsTable, ridesTable } from "@workspace/db";
  import { requireAuth, getUser } from "../lib/jwtAuth";

  const router: IRouter = Router();

  async function getDriverBalance(userId: number): Promise<number> {
    const txs = await db.select().from(walletTransactionsTable).where(eq(walletTransactionsTable.userId, userId));
    const credits = txs.filter(t => t.type === "credit").reduce((s, t) => s + Number(t.amount), 0);
    const debits = txs.filter(t => t.type === "debit").reduce((s, t) => s + Number(t.amount), 0);
    return Math.round((credits - debits) * 100) / 100;
  }

  router.get("/drivers/status", requireAuth, async (req, res): Promise<void> => {
    const { userId } = getUser(req);
    const [profile] = await db.select().from(driverProfilesTable).where(eq(driverProfilesTable.userId, userId));
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
    if (!profile || !user) { res.status(404).json({ error: "Perfil de motorista não encontrado" }); return; }

    const balance = await getDriverBalance(userId);
    res.json({
      id: profile.id, userId: profile.userId, name: user.name, phone: user.phone,
      vehicleModel: profile.vehicleModel, vehiclePlate: profile.vehiclePlate,
      isOnline: profile.isOnline, rating: Number(profile.rating),
      totalRides: profile.totalRides, balance,
      subscriptionStatus: profile.subscriptionStatus,
      subscriptionExpiresAt: profile.subscriptionExpiresAt?.toISOString() ?? null,
    });
  });

  router.patch("/drivers/status", requireAuth, async (req, res): Promise<void> => {
    const { userId } = getUser(req);
    const { isOnline } = req.body;
    if (typeof isOnline !== "boolean") { res.status(400).json({ error: "isOnline deve ser boolean" }); return; }

    const [profile] = await db.update(driverProfilesTable).set({ isOnline }).where(eq(driverProfilesTable.userId, userId)).returning();
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
    if (!profile || !user) { res.status(404).json({ error: "Perfil não encontrado" }); return; }

    const balance = await getDriverBalance(userId);
    res.json({
      id: profile.id, userId: profile.userId, name: user.name, phone: user.phone,
      vehicleModel: profile.vehicleModel, vehiclePlate: profile.vehiclePlate,
      isOnline: profile.isOnline, rating: Number(profile.rating),
      totalRides: profile.totalRides, balance,
      subscriptionStatus: profile.subscriptionStatus,
    });
  });

  router.get("/drivers/earnings", requireAuth, async (req, res): Promise<void> => {
    const { userId } = getUser(req);
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(todayStart); weekStart.setDate(weekStart.getDate() - 7);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const allTx = await db.select().from(walletTransactionsTable).where(eq(walletTransactionsTable.userId, userId)).orderBy(walletTransactionsTable.createdAt);
    const credits = allTx.filter((t) => t.type === "credit");

    const today = credits.filter(t => t.createdAt >= todayStart).reduce((s, t) => s + Number(t.amount), 0);
    const week = credits.filter(t => t.createdAt >= weekStart).reduce((s, t) => s + Number(t.amount), 0);
    const month = credits.filter(t => t.createdAt >= monthStart).reduce((s, t) => s + Number(t.amount), 0);

    const [profile] = await db.select().from(driverProfilesTable).where(eq(driverProfilesTable.userId, userId));
    const totalRidesData = await db.select().from(ridesTable).where(eq(ridesTable.driverId, userId));
    const balance = await getDriverBalance(userId);

    res.json({
      today: Math.round(today * 100) / 100,
      week: Math.round(week * 100) / 100,
      month: Math.round(month * 100) / 100,
      totalRides: totalRidesData.length,
      balance,
      rating: profile ? Number(profile.rating) : 5.00,
      recentTransactions: credits.slice(-10).reverse().map(t => ({
        id: t.id, type: t.type, amount: Number(t.amount),
        description: t.description, createdAt: t.createdAt.toISOString(),
      })),
    });
  });

  export default router;
  