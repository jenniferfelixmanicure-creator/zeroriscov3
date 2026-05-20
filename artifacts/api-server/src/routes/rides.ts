import { Router, type IRouter } from "express";
  import { and, eq, or } from "drizzle-orm";
  import crypto from "crypto";
  import { db } from "@workspace/db";
  import {
    ridesTable, categoriesTable, usersTable,
    driverProfilesTable, walletTransactionsTable,
  } from "@workspace/db";
  import { requireAuth, getUser } from "../lib/jwtAuth";
  import { calculateSmartPricesForAll } from "../lib/ai";
  import { notifyDriversForRide, emitToRide, emitToUser } from "../lib/socket";

  const router: IRouter = Router();

  // Rota real via OSRM — fallback para haversine
  async function getRouteData(originLat: number, originLng: number, destLat: number, destLng: number): Promise<{ distanceKm: number; durationMin: number }> {
    try {
      const url = `https://router.project-osrm.org/route/v1/driving/${originLng},${originLat};${destLng},${destLat}?overview=false`;
      const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
      const data = await res.json() as { code: string; routes: Array<{ distance: number; duration: number }> };
      if (data.code === "Ok" && data.routes.length > 0) {
        return { distanceKm: Math.round(data.routes[0].distance / 100) / 10, durationMin: Math.max(1, Math.round(data.routes[0].duration / 60)) };
      }
    } catch { /* fallback */ }
    const R = 6371;
    const dLat = ((destLat - originLat) * Math.PI) / 180;
    const dLng = ((destLng - originLng) * Math.PI) / 180;
    const a = Math.sin(dLat/2)**2 + Math.cos((originLat*Math.PI)/180)*Math.cos((destLat*Math.PI)/180)*Math.sin(dLng/2)**2;
    const distKm = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return { distanceKm: Math.round(distKm*10)/10, durationMin: Math.max(1, Math.round(distKm*3)) };
  }

  // Preço dinâmico baseado em demanda (corridas ativas vs motoristas online)
  async function getSurgeMultiplier(): Promise<number> {
    const [activeRides, onlineDrivers] = await Promise.all([
      db.select({ id: ridesTable.id }).from(ridesTable).where(
        or(eq(ridesTable.status, "searching"), eq(ridesTable.status, "accepted"), eq(ridesTable.status, "in_progress"))
      ),
      db.select({ id: driverProfilesTable.id }).from(driverProfilesTable).where(eq(driverProfilesTable.isOnline, true)),
    ]);
    const demand = activeRides.length;
    const supply = onlineDrivers.length;
    if (supply === 0) return 2.0;
    const ratio = demand / supply;
    if (ratio >= 2.0) return 2.0;
    if (ratio >= 1.5) return 1.7;
    if (ratio >= 1.2) return 1.4;
    if (ratio >= 1.0) return 1.2;
    return 1.0;
  }

  function calcFare(
    category: { baseFare: string; pricePerKm: string; pricePerMinute: string; minFare: string; multiplier: string },
    distanceKm: number, durationMin: number, surgeMultiplier = 1.0
  ): number {
    const base = Number(category.baseFare);
    const perKm = Number(category.pricePerKm);
    const perMin = Number(category.pricePerMinute);
    const min = Number(category.minFare);
    const hour = new Date().getHours();
    let dynamicMultiplier = Number(category.multiplier) * surgeMultiplier;
    if ((hour >= 7 && hour <= 9) || (hour >= 17 && hour <= 19)) dynamicMultiplier *= 1.4;
    else if (hour >= 22 || hour <= 5) dynamicMultiplier *= 1.2;
    return Math.max((base + distanceKm*perKm + durationMin*perMin) * dynamicMultiplier, min);
  }

  function formatRide(
    ride: typeof ridesTable.$inferSelect,
    category: typeof categoriesTable.$inferSelect,
    driver?: typeof usersTable.$inferSelect | null,
    driverProfile?: typeof driverProfilesTable.$inferSelect | null
  ) {
    return {
      id: ride.id, passengerId: ride.passengerId, driverId: ride.driverId,
      categoryId: ride.categoryId, categoryName: category.name, categoryIcon: category.icon,
      status: ride.status,
      originAddress: ride.originAddress, originLat: Number(ride.originLat), originLng: Number(ride.originLng),
      destinationAddress: ride.destinationAddress, destinationLat: Number(ride.destinationLat), destinationLng: Number(ride.destinationLng),
      estimatedDistance: Number(ride.estimatedDistance), estimatedDuration: ride.estimatedDuration,
      estimatedFare: Number(ride.estimatedFare), finalFare: ride.finalFare ? Number(ride.finalFare) : null,
      surgePriceMultiplier: Number(ride.surgePriceMultiplier ?? 1),
      verificationPin: ride.verificationPin,
      tripShareToken: ride.tripShareToken,
      scheduledFor: ride.scheduledFor?.toISOString() ?? null,
      driverName: driver?.name ?? null, driverPhone: driver?.phone ?? null,
      driverRating: driverProfile ? Number(driverProfile.rating) : null,
      driverVehicle: driverProfile?.vehicleModel ?? null, driverPlate: driverProfile?.vehiclePlate ?? null,
      createdAt: ride.createdAt.toISOString(), completedAt: ride.completedAt?.toISOString() ?? null,
    };
  }

  // Estimativa com rota real + IA única + surge pricing
  router.post("/rides/estimate", requireAuth, async (req, res): Promise<void> => {
    const { originLat, originLng, destinationLat, destinationLng } = req.body;
    if (!originLat || !originLng || !destinationLat || !destinationLng) {
      res.status(400).json({ error: "Coordenadas obrigatórias" }); return;
    }

    const [{ distanceKm, durationMin }, categories, surgeMultiplier] = await Promise.all([
      getRouteData(Number(originLat), Number(originLng), Number(destinationLat), Number(destinationLng)),
      db.select().from(categoriesTable).orderBy(categoriesTable.id),
      getSurgeMultiplier(),
    ]);

    const hour = new Date().getHours();
    const baseFares = categories.map(cat => ({
      id: cat.id, name: cat.name, baseFare: calcFare(cat, distanceKm, durationMin, surgeMultiplier),
    }));

    const aiPrices = await calculateSmartPricesForAll({ distanceKm, durationMin, weather: "Limpo", hour, categories: baseFares });
    const aiMap = new Map(aiPrices.map(p => [p.categoryId, p]));

    const estimates = categories.map(cat => {
      const base = baseFares.find(b => b.id === cat.id)?.baseFare ?? 0;
      const ai = aiMap.get(cat.id);
      return {
        categoryId: cat.id, categoryName: cat.name, categoryIcon: cat.icon, description: cat.description,
        estimatedDistance: distanceKm, estimatedDuration: durationMin,
        estimatedFare: Math.round((ai?.suggestedFare ?? base) * 100) / 100,
        surgeMultiplier,
        isSurge: surgeMultiplier > 1,
        aiJustification: ai?.justification ?? "Tarifa base ZeroRisco",
      };
    });

    res.json(estimates);
  });

  router.post("/rides", requireAuth, async (req, res): Promise<void> => {
    const { userId } = getUser(req);
    const {
      categoryId, originAddress, originLat, originLng,
      destinationAddress, destinationLat, destinationLng,
      estimatedDistance, estimatedDuration, estimatedFare, scheduledFor,
    } = req.body;

    if (!categoryId || !originAddress || !destinationAddress) {
      res.status(400).json({ error: "Campos obrigatórios faltando" }); return;
    }

    const [category] = await db.select().from(categoriesTable).where(eq(categoriesTable.id, Number(categoryId)));
    if (!category) { res.status(404).json({ error: "Categoria não encontrada" }); return; }

    const surgeMultiplier = await getSurgeMultiplier();
    const verificationPin = Math.floor(1000 + Math.random() * 9000).toString();
    const tripShareToken = crypto.randomBytes(16).toString("hex");

    const [ride] = await db.insert(ridesTable).values({
      passengerId: userId, categoryId: Number(categoryId), status: "searching",
      originAddress, originLat: String(originLat), originLng: String(originLng),
      destinationAddress, destinationLat: String(destinationLat), destinationLng: String(destinationLng),
      estimatedDistance: String(estimatedDistance), estimatedDuration: Number(estimatedDuration),
      estimatedFare: String(estimatedFare), surgePriceMultiplier: String(surgeMultiplier),
      verificationPin, tripShareToken,
      scheduledFor: scheduledFor ? new Date(scheduledFor) : null,
    }).returning();

    const catId = Number(categoryId);
    const allowedCategoryIds = catId === 1 ? [1] : catId === 2 ? [2] : catId === 3 ? [2,3] : [2,3,4];
    const rideFormatted = formatRide(ride, category);

    try { notifyDriversForRide(allowedCategoryIds, Number(originLat), Number(originLng), rideFormatted); } catch { /* ok */ }

    res.status(201).json(rideFormatted);
  });

  router.get("/rides", requireAuth, async (req, res): Promise<void> => {
    const { userId, role } = getUser(req);
    const { status } = req.query as { status?: string };
    let allRides: (typeof ridesTable.$inferSelect)[];

    if (role === "driver") {
      if (status === "searching") {
        const [profile] = await db.select().from(driverProfilesTable).where(eq(driverProfilesTable.userId, userId));
        const driverCatId = profile?.categoryId || 2;
        const allowedCategoryIds = driverCatId === 1 ? [1] : driverCatId === 2 ? [2] : driverCatId === 3 ? [2,3] : [2,3,4];
        allRides = await db.select().from(ridesTable).where(
          and(eq(ridesTable.status, "searching"), or(...allowedCategoryIds.map(id => eq(ridesTable.categoryId, id))))
        ).orderBy(ridesTable.createdAt);
      } else {
        allRides = await db.select().from(ridesTable).where(eq(ridesTable.driverId, userId)).orderBy(ridesTable.createdAt);
      }
    } else {
      allRides = await db.select().from(ridesTable).where(eq(ridesTable.passengerId, userId)).orderBy(ridesTable.createdAt);
    }

    if (status && status !== "searching") allRides = allRides.filter(r => r.status === status);

    const categories = await db.select().from(categoriesTable);
    const catMap = new Map(categories.map(c => [c.id, c]));

    const result = await Promise.all(allRides.map(async ride => {
      const cat = catMap.get(ride.categoryId)!;
      if (ride.driverId) {
        const [driver] = await db.select().from(usersTable).where(eq(usersTable.id, ride.driverId));
        const [dp] = await db.select().from(driverProfilesTable).where(eq(driverProfilesTable.userId, ride.driverId));
        return formatRide(ride, cat, driver, dp);
      }
      return formatRide(ride, cat);
    }));
    res.json(result);
  });

  router.get("/rides/:id", requireAuth, async (req, res): Promise<void> => {
    const id = parseInt(String(req.params.id), 10);
    const [ride] = await db.select().from(ridesTable).where(eq(ridesTable.id, id));
    if (!ride) { res.status(404).json({ error: "Corrida não encontrada" }); return; }
    const [category] = await db.select().from(categoriesTable).where(eq(categoriesTable.id, ride.categoryId));
    if (ride.driverId) {
      const [driver] = await db.select().from(usersTable).where(eq(usersTable.id, ride.driverId));
      const [dp] = await db.select().from(driverProfilesTable).where(eq(driverProfilesTable.userId, ride.driverId));
      res.json(formatRide(ride, category, driver, dp)); return;
    }
    res.json(formatRide(ride, category));
  });

  // Link público para compartilhar o trajeto (sem autenticação)
  router.get("/rides/share/:token", async (req, res): Promise<void> => {
    const [ride] = await db.select().from(ridesTable).where(eq(ridesTable.tripShareToken, String(req.params.token)));
    if (!ride) { res.status(404).json({ error: "Link expirado ou inválido" }); return; }
    const [category] = await db.select().from(categoriesTable).where(eq(categoriesTable.id, ride.categoryId));
    res.json({
      rideId: ride.id, status: ride.status, categoryName: category.name,
      originAddress: ride.originAddress, originLat: Number(ride.originLat), originLng: Number(ride.originLng),
      destinationAddress: ride.destinationAddress, destinationLat: Number(ride.destinationLat), destinationLng: Number(ride.destinationLng),
      estimatedFare: Number(ride.estimatedFare), createdAt: ride.createdAt.toISOString(),
    });
  });

  router.patch("/rides/:id/status", requireAuth, async (req, res): Promise<void> => {
    const id = parseInt(String(req.params.id), 10);
    const { status, driverId, reason } = req.body;
    const { userId, role } = getUser(req);
    if (!status) { res.status(400).json({ error: "Status obrigatório" }); return; }

    const [currentRide] = await db.select().from(ridesTable).where(eq(ridesTable.id, id));
    if (!currentRide) { res.status(404).json({ error: "Corrida não encontrada" }); return; }

    const updates: Partial<typeof ridesTable.$inferInsert> = { status };
    if (driverId) updates.driverId = Number(driverId);
    if (status === "in_progress") updates.startedAt = new Date();

    if (status === "completed") {
      updates.completedAt = new Date();
      const [cat] = await db.select().from(categoriesTable).where(eq(categoriesTable.id, currentRide.categoryId));
      const { distanceKm, durationMin } = await getRouteData(
        Number(currentRide.originLat), Number(currentRide.originLng),
        Number(currentRide.destinationLat), Number(currentRide.destinationLng)
      );
      const finalFare = Math.round(calcFare(cat, distanceKm, durationMin, Number(currentRide.surgePriceMultiplier)) * 100) / 100;
      updates.finalFare = String(finalFare);
      if (currentRide.driverId) {
        await db.insert(walletTransactionsTable).values({ userId: currentRide.driverId, rideId: currentRide.id, type: "credit", amount: String(finalFare), description: `Corrida #${currentRide.id} — ${currentRide.originAddress} → ${currentRide.destinationAddress}` });
        // Atualiza total de corridas do motorista
        const [dp] = await db.select().from(driverProfilesTable).where(eq(driverProfilesTable.userId, currentRide.driverId));
        if (dp) {
          const newTotal = (dp.totalRides ?? 0) + 1;
          const newAccepted = (dp.totalTripsAccepted ?? 0) + 1;
          const newRate = Math.round((newAccepted / Math.max(newTotal, 1)) * 10000) / 100;
          await db.update(driverProfilesTable).set({ totalRides: newTotal, totalTripsAccepted: newAccepted, acceptanceRate: String(newRate) }).where(eq(driverProfilesTable.userId, currentRide.driverId));
        }
        emitToUser(currentRide.driverId, "ride_completed", { rideId: id, finalFare });
      }
      await db.insert(walletTransactionsTable).values({ userId: currentRide.passengerId, rideId: currentRide.id, type: "debit", amount: String(finalFare), description: `Corrida #${currentRide.id}` });
      emitToUser(currentRide.passengerId, "ride_completed", { rideId: id, finalFare });
      emitToRide(id, "ride_status_update", { rideId: id, status: "completed", finalFare });
    }

    if (status === "cancelled") {
      if (reason) updates.cancellationReason = reason;
      if (currentRide.driverId && role === "passenger") {
        const cancellationFee = 5.00;
        await db.insert(walletTransactionsTable).values({ userId: currentRide.passengerId, rideId: currentRide.id, type: "debit", amount: String(cancellationFee), description: `Taxa de cancelamento — Corrida #${currentRide.id}` });
        await db.insert(walletTransactionsTable).values({ userId: currentRide.driverId, rideId: currentRide.id, type: "credit", amount: String(cancellationFee), description: `Compensação por cancelamento — Corrida #${currentRide.id}` });
        emitToUser(currentRide.driverId, "ride_cancelled", { rideId: id, reason: reason ?? "Passageiro cancelou", cancellationFee });
        // Atualiza taxa de cancelamento do passageiro (se tiver perfil de motorista)
      } else if (currentRide.driverId && role === "driver") {
        emitToUser(currentRide.passengerId, "ride_cancelled", { rideId: id, reason: reason ?? "Motorista cancelou" });
        // Atualiza taxa de cancelamento do motorista
        const [dp] = await db.select().from(driverProfilesTable).where(eq(driverProfilesTable.userId, currentRide.driverId));
        if (dp) {
          const newCancelled = (dp.totalTripsCancelled ?? 0) + 1;
          const total = Math.max((dp.totalRides ?? 0), 1);
          const newRate = Math.round((newCancelled / total) * 10000) / 100;
          await db.update(driverProfilesTable).set({ totalTripsCancelled: newCancelled, cancellationRate: String(newRate) }).where(eq(driverProfilesTable.userId, currentRide.driverId));
        }
      }
      emitToRide(id, "ride_status_update", { rideId: id, status: "cancelled" });
    }

    if (status === "accepted") {
      emitToUser(currentRide.passengerId, "ride_accepted", { rideId: id, driverId: driverId ?? currentRide.driverId });
      emitToRide(id, "ride_status_update", { rideId: id, status: "accepted" });
    }

    const [updated] = await db.update(ridesTable).set(updates).where(eq(ridesTable.id, id)).returning();
    if (!updated) { res.status(404).json({ error: "Corrida não encontrada" }); return; }
    const [category] = await db.select().from(categoriesTable).where(eq(categoriesTable.id, updated.categoryId));
    if (updated.driverId) {
      const [driver] = await db.select().from(usersTable).where(eq(usersTable.id, updated.driverId));
      const [dp] = await db.select().from(driverProfilesTable).where(eq(driverProfilesTable.userId, updated.driverId));
      res.json(formatRide(updated, category, driver, dp)); return;
    }
    res.json(formatRide(updated, category));
  });

  export default router;
  