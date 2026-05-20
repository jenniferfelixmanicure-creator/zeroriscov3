import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db } from "@workspace/db";
import { messagesTable, usersTable } from "@workspace/db";
import { requireAuth, getUser } from "../lib/jwtAuth";

const router: IRouter = Router();

router.get("/messages/:rideId", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.rideId) ? req.params.rideId[0] : req.params.rideId;
  const rideId = parseInt(raw, 10);

  const msgs = await db
    .select()
    .from(messagesTable)
    .where(eq(messagesTable.rideId, rideId))
    .orderBy(messagesTable.createdAt);

  const senderIds = [...new Set(msgs.map((m) => m.senderId))];
  const senders = await Promise.all(
    senderIds.map((id) => db.select().from(usersTable).where(eq(usersTable.id, id)))
  );
  const senderMap = new Map(
    senders.flat().map((u) => [u.id, u])
  );

  res.json(
    msgs.map((m) => ({
      id: m.id,
      rideId: m.rideId,
      senderId: m.senderId,
      senderName: senderMap.get(m.senderId)?.name ?? "Usuário",
      content: m.content,
      createdAt: m.createdAt.toISOString(),
    }))
  );
});

router.post("/messages/:rideId", requireAuth, async (req, res): Promise<void> => {
  const { userId } = getUser(req);
  const raw = Array.isArray(req.params.rideId) ? req.params.rideId[0] : req.params.rideId;
  const rideId = parseInt(raw, 10);
  const { content } = req.body;

  if (!content || typeof content !== "string") {
    res.status(400).json({ error: "Conteúdo obrigatório" });
    return;
  }

  const [msg] = await db
    .insert(messagesTable)
    .values({ rideId, senderId: userId, content })
    .returning();

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));

  res.status(201).json({
    id: msg.id,
    rideId: msg.rideId,
    senderId: msg.senderId,
    senderName: user?.name ?? "Usuário",
    content: msg.content,
    createdAt: msg.createdAt.toISOString(),
  });
});

export default router;
