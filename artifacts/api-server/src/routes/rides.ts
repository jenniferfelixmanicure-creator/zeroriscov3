import { Router, type IRouter } from "express";
  import { and, eq, or } from "drizzle-orm";
  import { db } from "@workspace/db";
  import {
    ridesTable,
    categoriesTable,
    usersTable,
    driverProfilesTable,
    walletTransactionsTable,
  } from "@workspace/db";
  import { requireAuth, getUser } from "../lib/jwtAuth";
  import { calculateSmartPricesForAll } from "../lib/ai";
  import { notifyDriversForRide, emitToRide, emitToUser } from "../lib/socket";

  const router: IRouter = Router();

  // Rota real via OSRM (gratuito, sem API key) — fallback para haversine se falhar
  async function getRouteData(
    originLat: number, originLng: number,
    destLat: number, destLng: number
  ): Promise<{ distanceKm: number; durationMin: number }> {
    try {
      const url = `https://router.project-osrm.org/route/v1/driving/${originLng},${originLat};${destLng},${destLat}?overview=false`;
      const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
      const data = await res.json() as { code: string; routes: Array<{ distance: number; duration: number }> };
      if (data.code === "Ok" && data.routes.length > 0) {
        return {
          distanceKm: Math.round(data.routes[0].distance / 100) / 10,
          durationMin: Math.max(1, Math.round(data.routes[0].duration / 60)),
        };
      }
    } catch { /* fallback abaixo */ }

    // Fallback: haversine em linha reta
    const R = 6371;
    const dLat = ((destLat - originLat) * Math.PI) / 180;
    const dLng = ((destLng - originLng) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((originLat * Math.PI) / 180) * Math.cos((destLat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
    const distKm = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return { distanceKm: Math.round(distKm * 10) / 10, durationMin: Math.max(1, Math.round(distKm * 3)) };
  }

  function calcFare(
    category: { baseFare: string; pricePerKm: string; pricePerMinute: string; minFare: string; multiplier: string },
    distanceKm: number,
    durationMin: number
  ): number {
    const base = Number(category.baseFare);
    const perKm = Number(category.pricePerKm);
    const perMin = Number(category.pricePerMinute);
    const min = Number(category.minFare);
    const hour = new Date().getHours();
    let dynamicMultiplier = Number(category.multiplier);
    if ((hour >= 7 && hour <= 9) || (hour >= 17 && hour <= 19)) dynamicMultiplier *= 1.4;
    else if (hour >= 22 || hour <= 5) dynamicMultiplier *= 1.2;
    return Math.max((base + distanceKm * perKm + durationMin * perMin) * dynamicMultiplier, min);
  }

  function formatRide(
    ride: typeof ridesTable.$inferSelect,
    category: typeof categoriesTable.$inferSelect,
    driver?: typeof usersTable.$inferSelect | null,
    driverProfile?: typeof driverProfilesTable.$inferSelect | null
  ) {
    return {
      id: ride.id,
      passengerId: ride.passengerId,
      driverId: ride.driverId,
      categoryId: ride.categoryId,
      categoryName: category.name,
      categoryIcon: category.icon,
      status: ride.status,
      originAddress: ride.originAddress,
      originLat: Number(ride.originLat),
      originLng: Number(ride.originLng),
      destinationAddress: ride.destinationAddress,
      destinationLat: Number(ride.destinationLat),
      destinationLng: Number(ride.destinationLng),
      estimatedDistance: Number(ride.estimatedDistance),
      estimatedDuration: ride.estimatedDuration,
      estimatedFare: Number(ride.estimatedFare),
      finalFare: ride.finalFare ? Number(ride.finalFare) : null,
      verificationPin: ride.verificationPin,
      driverName: driver?.name ?? null,
      driverPhone: driver?.phone ?? null,
      driverRating: driverProfile ? Number(driverProfile.rating) : null,
      driverVehicle: driverProfile?.vehicleModel ?? null,
      driverPlate: driverProfile?.vehiclePlate ?? null,
      createdAt: ride.createdAt.toISOString(),
      completedAt: ride.completedAt?.toISOString() ?? null,
    };
  }

  // Estimar preço com rota REAL e IA única para todas as categorias
  router.post("/rides/estimate", requireAuth, async (req, res): Promise<void> => {
    const { originLat, originLng, destinationLat, destinationLng } = req.body;

    if (!originLat || !originLng || !destinationLat || !destinationLng) {
      res.status(400).json({ error: "Coordenadas obrigatórias" });
      return;
    }

    const { distanceKm, durationMin } = await getRouteData(
      Number(originLat), Number(originLng),
      Number(destinationLat), Number(destinationLng)
    );

    const categories = await db.select().from(categoriesTable).orderBy(categoriesTable.id);
    const hour = new Date().getHours();

    const baseFares = categories.map((cat) => ({
      id: cat.id,
      name: cat.name,
      baseFare: calcFare(cat, distanceKm, durationMin),
    }));

    // UMA chamada de IA para todas as categorias
    const aiPrices = await calculateSmartPricesForAll({
      distanceKm,
      durationMin,
      weather: "Limpo",
      hour,
      categories: baseFares,
    });

    const aiMap = new Map(aiPrices.map((p) => [p.categoryId, p]));

    const estimates = categories.map((cat) => {
      const base = baseFares.find((b) => b.id === cat.id)?.baseFare ?? 0;
      const ai = aiMap.get(cat.id);
      const finalFare = ai?.suggestedFare ?? base;
      return {
        categoryId: cat.id,
        categoryName: cat.name,
        categoryIcon: cat.icon,
        description: cat.description,
        estimatedDistance: distanceKm,
        estimatedDuration: durationMin,
        estimatedFare: Math.round(finalFare * 100) / 100,
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
      estimatedDistance, estimatedDuration, estimatedFare,
    } = req.body;

    if (!categoryId || !originAddress || !destinationAddress) {
      res.status(400).json({ error: "Campos obrigatórios faltando" });
      return;
    }

    const [category] = await db.select().from(categoriesTable).where(eq(categoriesTable.id, Number(categoryId)));
    if (!category) {
      res.status(404).json({ error: "Categoria não encontrada" });
      return;
    }

    const verificationPin = Math.floor(1000 + Math.random() * 9000).toString();

    const [ride] = await db.insert(ridesTable).values({
      passengerId: userId,
      categoryId: Number(categoryId),
      status: "searching",
      originAddress,
      originLat: String(originLat),
      originLng: String(originLng),
      destinationAddress,
      destinationLat: String(destinationLat),
      destinationLng: String(destinationLng),
      estimatedDistance: String(estimatedDistance),
      estimatedDuration: Number(estimatedDuration),
      estimatedFare: String(estimatedFare),
      verificationPin,
    }).returning();

    // Determina categorias elegíveis para notificar motoristas
    const catId = Number(categoryId);
    let allowedCategoryIds: number[] = [];
    if (catId === 1) allowedCategoryIds = [1];
    else if (catId === 2) allowedCategoryIds = [2];
    else if (catId === 3) allowedCategoryIds = [2, 3];
    else if (catId === 4) allowedCategoryIds = [2, 3, 4];

    const rideFormatted = formatRide(ride, category);

    // Matching inteligente — notifica motorista mais próximo primeiro
    try {
      notifyDriversForRide(allowedCategoryIds, Number(originLat), Number(originLng), rideFormatted);
    } catch { /* socket pode não estar pronto em dev */ }

    res.status(201).json(rideFormatted);
  });

  router.get("/rides", requireAuth, async (req, res): Promise<void> => {
    const { userId, role } = getUser(req);
    const { status } = req.query as { status?: string };

    let allRides: (typeof ridesTable.$inferSelect)[];

    if (role === "driver") {
      if (status === "searching") {
        const [profile] = await db.select().from(driverProfilesTable).where(eq(driverProfilesTable.userId, userId));
        let allowedCategoryIds: number[] = [];
        const driverCatId = profile?.categoryId || 2;
        if (driverCatId === 1) allowedCategoryIds = [1];
        else if (driverCatId === 2) allowedCategoryIds = [2];
        else if (driverCatId === 3) allowedCategoryIds = [2, 3];
        else if (driverCatId === 4) allowedCategoryIds = [2, 3, 4];

        allRides = await db.select().from(ridesTable).where(
          and(eq(ridesTable.status, "searching"), or(...allowedCategoryIds.map(id => eq(ridesTable.categoryId, id))))
        ).orderBy(ridesTable.createdAt);
      } else {
        allRides = await db.select().from(ridesTable).where(eq(ridesTable.driverId, userId)).orderBy(ridesTable.createdAt);
      }
    } else {
      allRides = await db.select().from(ridesTable).where(eq(ridesTable.passengerId, userId)).orderBy(ridesTable.createdAt);
    }

    if (status && status !== "searching") {
      allRides = allRides.filter((r) => r.status === status);
    }

    const categories = await db.select().from(categoriesTable);
    const catMap = new Map(categories.map((c) => [c.id, c]));

    const result = await Promise.all(
      allRides.map(async (ride) => {
        const cat = catMap.get(ride.categoryId)!;
        if (ride.driverId) {
          const [driver] = await db.select().from(usersTable).where(eq(usersTable.id, ride.driverId));
          const [dp] = await db.select().from(driverProfilesTable).where(eq(driverProfilesTable.userId, ride.driverId));
          return formatRide(ride, cat, driver, dp);
        }
        return formatRide(ride, cat);
      })
    );

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
      res.json(formatRide(ride, category, driver, dp));
      return;
    }
    res.json(formatRide(ride, category));
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
      const finalFare = Math.round(calcFare(cat, distanceKm, durationMin) * 100) / 100;
      updates.finalFare = String(finalFare);

      if (currentRide.driverId) {
        await db.insert(walletTransactionsTable).values({
          userId: currentRide.driverId, rideId: currentRide.id, type: "credit",
          amount: String(finalFare), description: `Corrida #${currentRide.id} — ${currentRide.originAddress} → ${currentRide.destinationAddress}`,
        });
      }
      await db.insert(walletTransactionsTable).values({
        userId: currentRide.passengerId, rideId: currentRide.id, type: "debit",
        amount: String(finalFare), description: `Corrida #${currentRide.id} — ${currentRide.originAddress} → ${currentRide.destinationAddress}`,
      });

      if (currentRide.driverId) emitToUser(currentRide.driverId, "ride_completed", { rideId: id, finalFare });
      emitToUser(currentRide.passengerId, "ride_completed", { rideId: id, finalFare });
      emitToRide(id, "ride_status_update", { rideId: id, status: "completed", finalFare });
    }

    if (status === "cancelled") {
      if (reason) updates.cancellationReason = reason;

      // Taxa de cancelamento: R$5 se o motorista já aceitou e o passageiro cancela
      if (currentRide.driverId && role === "passenger") {
        const cancellationFee = 5.00;
        await db.insert(walletTransactionsTable).values({
          userId: currentRide.passengerId, rideId: currentRide.id, type: "debit",
          amount: String(cancellationFee), description: `Taxa de cancelamento — Corrida #${currentRide.id}`,
        });
        await db.insert(walletTransactionsTable).values({
          userId: currentRide.driverId, rideId: currentRide.id, type: "credit",
          amount: String(cancellationFee), description: `Compensação por cancelamento — Corrida #${currentRide.id}`,
        });
        emitToUser(currentRide.driverId, "ride_cancelled", { rideId: id, reason: reason ?? "Passageiro cancelou", cancellationFee });
      } else if (currentRide.driverId) {
        emitToUser(currentRide.passengerId, "ride_cancelled", { rideId: id, reason: reason ?? "Motorista cancelou" });
      }

      emitToRide(id, "ride_status_update", { rideId: id, status: "cancelled" });
    }

    if (status === "accepted") {
      emitToUser(currentRide.passengerId, "ride_accepted", {
        rideId: id, driverId: driverId ?? currentRide.driverId,
      });
      emitToRide(id, "ride_status_update", { rideId: id, status: "accepted" });
    }

    const [updated] = await db.update(ridesTable).set(updates).where(eq(ridesTable.id, id)).returning();
    if (!updated) { res.status(404).json({ error: "Corrida não encontrada" }); return; }

    const [category] = await db.select().from(categoriesTable).where(eq(categoriesTable.id, updated.categoryId));
    if (updated.driverId) {
      const [driver] = await db.select().from(usersTable).where(eq(usersTable.id, updated.driverId));
      const [dp] = await db.select().from(driverProfilesTable).where(eq(driverProfilesTable.userId, updated.driverId));
      res.json(formatRide(updated, category, driver, dp));
      return;
    }
    res.json(formatRide(updated, category));
  });

  export default router;
  