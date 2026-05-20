import { Router, type IRouter } from "express";
  import { and, eq } from "drizzle-orm";
  import { db } from "@workspace/db";
  import { driverProfilesTable, usersTable, walletTransactionsTable, ridesTable } from "@workspace/db";
  import { requireAuth, getUser } from "../lib/jwtAuth";
  import { getNearbyDriversFromMemory } from "../lib/socket";

  const router: IRouter = Router();

  async function getDriverBalance(userId: number): Promise<number> {
    const txs = await db.select().from(walletTransactionsTable).where(eq(walletTransactionsTable.userId, userId));
    const credits = txs.filter(t => t.type === "credit").reduce((s, t) => s + Number(t.amount), 0);
    const debits  = txs.filter(t => t.type === "debit").reduce((s, t)  => s + Number(t.amount), 0);
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
      acceptanceRate: Number(profile.acceptanceRate),
      cancellationRate: Number(profile.cancellationRate),
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
      totalRides: profile.totalRides, balance, subscriptionStatus: profile.subscriptionStatus,
    });
  });

  // Motoristas próximos (para o mapa do passageiro)
  router.get("/drivers/nearby", requireAuth, async (req, res): Promise<void> => {
    const { lat, lng, radius = "5", categoryId } = req.query as Record<string, string>;
    if (!lat || !lng) { res.status(400).json({ error: "lat e lng são obrigatórios" }); return; }

    const radiusKm = Math.min(Number(radius), 20);
    const catIds = categoryId ? [Number(categoryId)] : undefined;

    // Tenta mapa em memória primeiro (mais atualizado)
    const inMemory = getNearbyDriversFromMemory(Number(lat), Number(lng), radiusKm, catIds);

    if (inMemory.length > 0) {
      res.json(inMemory.map(d => ({ driverId: d.driverId, lat: d.lat, lng: d.lng, distKm: d.distKm, categoryId: d.categoryId })));
      return;
    }

    // Fallback: busca última localização conhecida no banco (motoristas que enviaram localização recentemente)
    const fiveMinAgo = new Date(Date.now() - 5 * 60_000);
    const onlineDrivers = await db.select({
      userId: driverProfilesTable.userId,
      categoryId: driverProfilesTable.categoryId,
      lastKnownLat: driverProfilesTable.lastKnownLat,
      lastKnownLng: driverProfilesTable.lastKnownLng,
      lastLocationAt: driverProfilesTable.lastLocationAt,
    }).from(driverProfilesTable).where(
      and(eq(driverProfilesTable.isOnline, true))
    );

    const R = 6371;
    const nearby = onlineDrivers
      .filter(d =>
        d.lastKnownLat && d.lastKnownLng && d.lastLocationAt && d.lastLocationAt > fiveMinAgo &&
        (!catIds || catIds.includes(d.categoryId ?? 0))
      )
      .map(d => {
        const dLat = ((Number(d.lastKnownLat) - Number(lat)) * Math.PI) / 180;
        const dLng = ((Number(d.lastKnownLng) - Number(lng)) * Math.PI) / 180;
        const a = Math.sin(dLat/2)**2 + Math.cos((Number(lat)*Math.PI)/180) * Math.cos((Number(d.lastKnownLat)*Math.PI)/180) * Math.sin(dLng/2)**2;
        const distKm = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return { driverId: d.userId, lat: Number(d.lastKnownLat), lng: Number(d.lastKnownLng), distKm: Math.round(distKm*10)/10, categoryId: d.categoryId };
      })
      .filter(d => d.distKm <= radiusKm)
      .sort((a, b) => a.distKm - b.distKm);

    res.json(nearby);
  });

  // Registra token FCM para push notifications
  router.post("/drivers/fcm-token", requireAuth, async (req, res): Promise<void> => {
    const { userId } = getUser(req);
    const { fcmToken } = req.body;
    if (!fcmToken) { res.status(400).json({ error: "fcmToken obrigatório" }); return; }
    await db.update(usersTable).set({ fcmToken }).where(eq(usersTable.id, userId));
    res.json({ success: true });
  });

  // Passageiro também pode registrar token FCM
  router.post("/users/fcm-token", requireAuth, async (req, res): Promise<void> => {
    const { userId } = getUser(req);
    const { fcmToken } = req.body;
    if (!fcmToken) { res.status(400).json({ error: "fcmToken obrigatório" }); return; }
    await db.update(usersTable).set({ fcmToken }).where(eq(usersTable.id, userId));
    res.json({ success: true });
  });

  router.get("/drivers/earnings", requireAuth, async (req, res): Promise<void> => {
    const { userId } = getUser(req);
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(todayStart); weekStart.setDate(weekStart.getDate() - 7);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const allTx = await db.select().from(walletTransactionsTable).where(eq(walletTransactionsTable.userId, userId)).orderBy(walletTransactionsTable.createdAt);
    const credits = allTx.filter(t => t.type === "credit");

    const today = credits.filter(t => t.createdAt >= todayStart).reduce((s,t) => s + Number(t.amount), 0);
    const week  = credits.filter(t => t.createdAt >= weekStart).reduce((s,t) => s + Number(t.amount), 0);
    const month = credits.filter(t => t.createdAt >= monthStart).reduce((s,t) => s + Number(t.amount), 0);

    const [profile] = await db.select().from(driverProfilesTable).where(eq(driverProfilesTable.userId, userId));
    const balance = await getDriverBalance(userId);
    const totalRidesData = await db.select().from(ridesTable).where(eq(ridesTable.driverId, userId));

    res.json({
      today: Math.round(today*100)/100,
      week:  Math.round(week*100)/100,
      month: Math.round(month*100)/100,
      totalRides: totalRidesData.length,
      balance,
      rating: profile ? Number(profile.rating) : 5.00,
      acceptanceRate: profile ? Number(profile.acceptanceRate) : 100,
      cancellationRate: profile ? Number(profile.cancellationRate) : 0,
      recentTransactions: credits.slice(-10).reverse().map(t => ({
        id: t.id, type: t.type, amount: Number(t.amount),
        description: t.description, createdAt: t.createdAt.toISOString(),
      })),
    });
  });

  export default router;
  