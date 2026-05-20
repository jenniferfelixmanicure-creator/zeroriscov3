import { Router, type IRouter } from "express";
  import { eq } from "drizzle-orm";
  import { db } from "@workspace/db";
  import { ridesTable, sosEventsTable } from "@workspace/db";
  import { requireAuth, getUser } from "../lib/jwtAuth";
  import { emitToUser } from "../lib/socket";
  import { logger } from "../lib/logger";

  const router: IRouter = Router();

  router.post("/sos", requireAuth, async (req, res): Promise<void> => {
    const { userId } = getUser(req);
    const { rideId, lat, lng, message } = req.body;

    logger.warn({ userId, rideId, lat, lng, message }, "SOS acionado!");

    // Persiste o evento no banco
    const [event] = await db.insert(sosEventsTable).values({
      userId,
      rideId: rideId ? Number(rideId) : null,
      lat: lat ? String(lat) : null,
      lng: lng ? String(lng) : null,
      message: message ?? "SOS acionado pelo usuário",
      status: "open",
    }).returning();

    // Busca a corrida para notificar o outro participante
    let rideInfo: { driverId: number | null; passengerId: number } | null = null;
    if (rideId) {
      const [ride] = await db.select({ driverId: ridesTable.driverId, passengerId: ridesTable.passengerId })
        .from(ridesTable).where(eq(ridesTable.id, Number(rideId)));
      if (ride) rideInfo = ride;
    }

    const alertPayload = {
      sosEventId: event.id,
      type: "sos",
      userId,
      rideId: rideId ?? null,
      lat: lat ?? null,
      lng: lng ?? null,
      message: message ?? "SOS acionado pelo usuário",
      createdAt: event.createdAt.toISOString(),
    };

    try {
      // Notifica painel admin (userId 0 = sala de admins)
      emitToUser(0, "sos_alert", alertPayload);
      // Notifica o outro participante da corrida
      if (rideInfo) {
        const otherUserId = userId === rideInfo.passengerId ? rideInfo.driverId : rideInfo.passengerId;
        if (otherUserId) emitToUser(otherUserId, "sos_alert", { ...alertPayload, fromParticipant: true });
      }
    } catch { /* socket pode não estar pronto */ }

    res.json({
      success: true,
      sosEventId: event.id,
      message: "SOS enviado. Nossa equipe foi notificada e entrará em contato imediatamente.",
      supportPhone: process.env.SUPPORT_PHONE ?? "0800-ZERORISCO",
    });
  });

  // Admin: lista SOS abertos
  router.get("/sos/open", requireAuth, async (req, res): Promise<void> => {
    const { role } = getUser(req);
    if (role !== "admin") { res.status(403).json({ error: "Acesso negado" }); return; }
    const events = await db.select().from(sosEventsTable)
      .where(eq(sosEventsTable.status, "open"))
      .orderBy(sosEventsTable.createdAt);
    res.json(events.map(e => ({
      id: e.id, userId: e.userId, rideId: e.rideId,
      lat: e.lat ? Number(e.lat) : null, lng: e.lng ? Number(e.lng) : null,
      message: e.message, status: e.status, createdAt: e.createdAt.toISOString(),
    })));
  });

  // Admin: resolve SOS
  router.patch("/sos/:id/resolve", requireAuth, async (req, res): Promise<void> => {
    const { role, userId } = getUser(req);
    if (role !== "admin") { res.status(403).json({ error: "Acesso negado" }); return; }
    const id = parseInt(String(req.params.id), 10);
    await db.update(sosEventsTable)
      .set({ status: "resolved", resolvedAt: new Date(), resolvedBy: userId })
      .where(eq(sosEventsTable.id, id));
    res.json({ success: true });
  });

  export default router;
  