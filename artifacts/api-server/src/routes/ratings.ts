import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db } from "@workspace/db";
import { ratingsTable } from "@workspace/db";
import { requireAuth, getUser } from "../lib/jwtAuth";

const router: IRouter = Router();

router.post("/ratings", requireAuth, async (req, res): Promise<void> => {
  const { userId } = getUser(req);
  const { rideId, toUserId, rating, comment } = req.body;

  if (!rideId || !toUserId || !rating) {
    res.status(400).json({ error: "Campos obrigatórios faltando" });
    return;
  }

  if (rating < 1 || rating > 5) {
    res.status(400).json({ error: "Avaliação deve ser entre 1 e 5" });
    return;
  }

  const [created] = await db
    .insert(ratingsTable)
    .values({
      rideId: Number(rideId),
      fromUserId: userId,
      toUserId: Number(toUserId),
      rating: Number(rating),
      comment: comment ?? null,
    })
    .returning();

  res.status(201).json({
    id: created.id,
    rideId: created.rideId,
    fromUserId: created.fromUserId,
    toUserId: created.toUserId,
    rating: created.rating,
    comment: created.comment,
    createdAt: created.createdAt.toISOString(),
  });
});

router.get("/ratings", requireAuth, async (req, res): Promise<void> => {
  const { userId } = getUser(req);

  const ratings = await db
    .select()
    .from(ratingsTable)
    .where(eq(ratingsTable.toUserId, userId))
    .orderBy(ratingsTable.createdAt);

  res.json(
    ratings.map((r) => ({
      id: r.id,
      rideId: r.rideId,
      fromUserId: r.fromUserId,
      toUserId: r.toUserId,
      rating: r.rating,
      comment: r.comment,
      createdAt: r.createdAt.toISOString(),
    }))
  );
});

export default router;
