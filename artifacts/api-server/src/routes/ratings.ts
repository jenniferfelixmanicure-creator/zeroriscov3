import { Router, type IRouter } from "express";
  import { and, eq } from "drizzle-orm";
  import { db } from "@workspace/db";
  import { ratingsTable, ridesTable, driverProfilesTable } from "@workspace/db";
  import { requireAuth, getUser } from "../lib/jwtAuth";

  const router: IRouter = Router();

  router.post("/ratings", requireAuth, async (req, res): Promise<void> => {
    const { userId } = getUser(req);
    const { rideId, toUserId, rating, comment } = req.body;

    if (!rideId || !toUserId || !rating) {
      res.status(400).json({ error: "Campos obrigatórios faltando" }); return;
    }
    if (rating < 1 || rating > 5) {
      res.status(400).json({ error: "Avaliação deve ser entre 1 e 5" }); return;
    }

    const [ride] = await db.select().from(ridesTable).where(eq(ridesTable.id, Number(rideId)));
    if (!ride) { res.status(404).json({ error: "Corrida não encontrada" }); return; }

    // Valida que quem avalia participou da corrida
    const isPassenger = ride.passengerId === userId;
    const isDriver = ride.driverId === userId;
    if (!isPassenger && !isDriver) {
      res.status(403).json({ error: "Você não participou desta corrida" }); return;
    }

    // Valida que quem recebe a avaliação também participou
    const toId = Number(toUserId);
    const toIsParticipant = toId === ride.passengerId || toId === ride.driverId;
    if (!toIsParticipant) {
      res.status(400).json({ error: "Usuário avaliado não participou desta corrida" }); return;
    }

    // Impede avaliação duplicada para o mesmo par rideId+fromUserId+toUserId
    const [existing] = await db.select().from(ratingsTable).where(
      and(eq(ratingsTable.rideId, Number(rideId)), eq(ratingsTable.fromUserId, userId), eq(ratingsTable.toUserId, toId))
    );
    if (existing) {
      res.status(409).json({ error: "Você já avaliou esta corrida" }); return;
    }

    const [created] = await db.insert(ratingsTable).values({
      rideId: Number(rideId), fromUserId: userId, toUserId: toId,
      rating: Number(rating), comment: comment ?? null,
    }).returning();

    // Recalcula média de avaliação do motorista quando ele é avaliado
    if (ride.driverId && toId === ride.driverId) {
      const allRatings = await db.select().from(ratingsTable).where(eq(ratingsTable.toUserId, ride.driverId));
      const avg = allRatings.reduce((sum, r) => sum + r.rating, 0) / allRatings.length;
      await db.update(driverProfilesTable)
        .set({ rating: avg.toFixed(2) })
        .where(eq(driverProfilesTable.userId, ride.driverId));
    }

    res.status(201).json({
      id: created.id, rideId: created.rideId, fromUserId: created.fromUserId,
      toUserId: created.toUserId, rating: created.rating, comment: created.comment,
      createdAt: created.createdAt.toISOString(),
    });
  });

  router.get("/ratings", requireAuth, async (req, res): Promise<void> => {
    const { userId } = getUser(req);
    const ratings = await db.select().from(ratingsTable)
      .where(eq(ratingsTable.toUserId, userId)).orderBy(ratingsTable.createdAt);

    res.json(ratings.map((r) => ({
      id: r.id, rideId: r.rideId, fromUserId: r.fromUserId, toUserId: r.toUserId,
      rating: r.rating, comment: r.comment, createdAt: r.createdAt.toISOString(),
    })));
  });

  export default router;
  