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
import { calculateSmartPrice } from "../lib/ai";

const router: IRouter = Router();

function calcDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
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
  
  // Multiplicador dinâmico baseado no horário (exemplo simples)
  const hour = new Date().getHours();
  let dynamicMultiplier = Number(category.multiplier);
  
  // Horário de pico: 07-09h e 17-19h
  if ((hour >= 7 && hour <= 9) || (hour >= 17 && hour <= 19)) {
    dynamicMultiplier *= 1.4;
  } else if (hour >= 22 || hour <= 5) {
    dynamicMultiplier *= 1.2;
  }

  const fare = (base + distanceKm * perKm + durationMin * perMin) * dynamicMultiplier;
  return Math.max(fare, min);
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
    driverName: driver?.name ?? null,
    driverPhone: driver?.phone ?? null,
    driverRating: driverProfile ? Number(driverProfile.rating) : null,
    driverVehicle: driverProfile?.vehicleModel ?? null,
    driverPlate: driverProfile?.vehiclePlate ?? null,
    createdAt: ride.createdAt.toISOString(),
    completedAt: ride.completedAt?.toISOString() ?? null,
  };
}

router.post("/rides/estimate", requireAuth, async (req, res): Promise<void> => {
  const { originLat, originLng, destinationLat, destinationLng } = req.body;

  if (!originLat || !originLng || !destinationLat || !destinationLng) {
    res.status(400).json({ error: "Coordenadas obrigatórias" });
    return;
  }

  const distance = calcDistance(
    Number(originLat),
    Number(originLng),
    Number(destinationLat),
    Number(destinationLng)
  );
  const durationMin = Math.round(distance * 3);

  const categories = await db.select().from(categoriesTable).orderBy(categoriesTable.id);

  const estimates = await Promise.all(
    categories.map(async (cat) => {
      const baseFare = calcFare(cat, distance, durationMin);
      
      // Consultar IA para ajuste dinâmico
      const smartData = await calculateSmartPrice({
        distance,
        duration: durationMin,
        category: cat.name,
        weather: "Limpo",
      });

      const finalFare = smartData?.suggestedPrice || baseFare;

      return {
        categoryId: cat.id,
        categoryName: cat.name,
        categoryIcon: cat.icon,
        description: cat.description,
        estimatedDistance: Math.round(distance * 10) / 10,
        estimatedDuration: durationMin,
        estimatedFare: Math.round(finalFare * 100) / 100,
        aiJustification: smartData?.justification || "Tarifa base ZeroRisco",
      };
    })
  );

  res.json(estimates);
});

router.post("/rides", requireAuth, async (req, res): Promise<void> => {
  const { userId } = getUser(req);
  const {
    categoryId,
    originAddress,
    originLat,
    originLng,
    destinationAddress,
    destinationLat,
    destinationLng,
    estimatedDistance,
    estimatedDuration,
    estimatedFare,
  } = req.body;

  if (!categoryId || !originAddress || !destinationAddress) {
    res.status(400).json({ error: "Campos obrigatórios faltando" });
    return;
  }

  const [category] = await db
    .select()
    .from(categoriesTable)
    .where(eq(categoriesTable.id, Number(categoryId)));

  if (!category) {
    res.status(404).json({ error: "Categoria não encontrada" });
    return;
  }

  // Gerar PIN de 4 dígitos para segurança extra
  const verificationPin = Math.floor(1000 + Math.random() * 9000).toString();

  const [ride] = await db
    .insert(ridesTable)
    .values({
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
    })
    .returning();

  res.status(201).json(formatRide(ride, category));
});

router.get("/rides", requireAuth, async (req, res): Promise<void> => {
  const { userId, role } = getUser(req);
  const { status } = req.query as { status?: string };

  let allRides: (typeof ridesTable.$inferSelect)[];

  if (role === "driver") {
    if (status === "searching") {
      // Obter o perfil do motorista para saber as categorias permitidas
      const [profile] = await db.select().from(driverProfilesTable).where(eq(driverProfilesTable.userId, userId));
      
      // Lógica de categorias:
      // Moto (ID 1) recebe apenas Moto
      // Básico (ID 2) recebe apenas Básico
      // Intermediário (ID 3) recebe Básico + Intermediário
      // VIP (ID 4) recebe Básico + Intermediário + VIP
      
      let allowedCategoryIds: number[] = [];
      const driverCatId = profile?.categoryId || 2; // Default para Básico se não definido

      if (driverCatId === 1) allowedCategoryIds = [1];
      else if (driverCatId === 2) allowedCategoryIds = [2];
      else if (driverCatId === 3) allowedCategoryIds = [2, 3];
      else if (driverCatId === 4) allowedCategoryIds = [2, 3, 4];

      allRides = await db
        .select()
        .from(ridesTable)
        .where(
          and(
            eq(ridesTable.status, "searching"),
            // Filtro por categorias permitidas (simulado com inArray se disponível, ou lógica manual)
            or(...allowedCategoryIds.map(id => eq(ridesTable.categoryId, id)))
          )
        )
        .orderBy(ridesTable.createdAt);
    } else {
      allRides = await db
        .select()
        .from(ridesTable)
        .where(eq(ridesTable.driverId, userId))
        .orderBy(ridesTable.createdAt);
    }
  } else {
    allRides = await db
      .select()
      .from(ridesTable)
      .where(eq(ridesTable.passengerId, userId))
      .orderBy(ridesTable.createdAt);
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
        const [driver] = await db
          .select()
          .from(usersTable)
          .where(eq(usersTable.id, ride.driverId));
        const [dp] = await db
          .select()
          .from(driverProfilesTable)
          .where(eq(driverProfilesTable.userId, ride.driverId));
        return formatRide(ride, cat, driver, dp);
      }
      return formatRide(ride, cat);
    })
  );

  res.json(result);
});

router.get("/rides/:id", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

  const [ride] = await db.select().from(ridesTable).where(eq(ridesTable.id, id));
  if (!ride) {
    res.status(404).json({ error: "Corrida não encontrada" });
    return;
  }

  const [category] = await db
    .select()
    .from(categoriesTable)
    .where(eq(categoriesTable.id, ride.categoryId));

  if (ride.driverId) {
    const [driver] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, ride.driverId));
    const [dp] = await db
      .select()
      .from(driverProfilesTable)
      .where(eq(driverProfilesTable.userId, ride.driverId));
    res.json(formatRide(ride, category, driver, dp));
    return;
  }

  res.json(formatRide(ride, category));
});

router.patch("/rides/:id/status", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const { status, driverId } = req.body;

  if (!status) {
    res.status(400).json({ error: "Status obrigatório" });
    return;
  }

  const updates: Partial<typeof ridesTable.$inferInsert> = { status };

  if (driverId) updates.driverId = Number(driverId);
  if (status === "in_progress") updates.startedAt = new Date();
  if (status === "completed") {
    updates.completedAt = new Date();
    const [ride] = await db.select().from(ridesTable).where(eq(ridesTable.id, id));
    if (ride) {
      const [cat] = await db
        .select()
        .from(categoriesTable)
        .where(eq(categoriesTable.id, ride.categoryId));
      const distance = Number(ride.estimatedDistance);
      const duration = ride.estimatedDuration;
      const finalFare = Math.round(calcFare(cat, distance, duration) * 100) / 100;
      updates.finalFare = String(finalFare);

      // Add wallet credit for driver
      if (ride.driverId) {
        await db.insert(walletTransactionsTable).values({
          userId: ride.driverId,
          rideId: ride.id,
          type: "credit",
          amount: String(finalFare * 0.8),
          description: `Corrida #${ride.id} - ${ride.originAddress} → ${ride.destinationAddress}`,
        });
      }

      // Add wallet debit for passenger
      await db.insert(walletTransactionsTable).values({
        userId: ride.passengerId,
        rideId: ride.id,
        type: "debit",
        amount: String(finalFare),
        description: `Corrida #${ride.id} - ${ride.originAddress} → ${ride.destinationAddress}`,
      });
    }
  }

  const [updated] = await db
    .update(ridesTable)
    .set(updates)
    .where(eq(ridesTable.id, id))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Corrida não encontrada" });
    return;
  }

  const [category] = await db
    .select()
    .from(categoriesTable)
    .where(eq(categoriesTable.id, updated.categoryId));

  if (updated.driverId) {
    const [driver] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, updated.driverId));
    const [dp] = await db
      .select()
      .from(driverProfilesTable)
      .where(eq(driverProfilesTable.userId, updated.driverId));
    res.json(formatRide(updated, category, driver, dp));
    return;
  }

  res.json(formatRide(updated, category));
});

export default router;
