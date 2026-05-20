import { Router, type IRouter } from "express";
  import { db } from "@workspace/db";
  import { ridesTable } from "@workspace/db";
  import { eq } from "drizzle-orm";
  import { requireAuth, getUser } from "../lib/jwtAuth";
  import { emitToUser } from "../lib/socket";
  import { logger } from "../lib/logger";

  const router: IRouter = Router();

  router.post("/sos", requireAuth, async (req, res): Promise<void> => {
    const { userId } = getUser(req);
    const { rideId, lat, lng, message } = req.body;

    logger.warn({ userId, rideId, lat, lng, message }, "🚨 SOS acionado!");

    // Busca informações da corrida para contexto
    let rideInfo: { driverId: number | null; passengerId: number } | null = null;
    if (rideId) {
      const [ride] = await db.select({
        driverId: ridesTable.driverId,
        passengerId: ridesTable.passengerId,
      }).from(ridesTable).where(eq(ridesTable.id, Number(rideId)));
      if (ride) rideInfo = ride;
    }

    const alertPayload = {
      type: "sos",
      userId,
      rideId: rideId ?? null,
      lat: lat ?? null,
      lng: lng ?? null,
      message: message ?? "SOS acionado pelo usuário",
      createdAt: new Date().toISOString(),
    };

    // Notifica painel administrativo (userId 0 = broadcast admin)
    try {
      emitToUser(0, "sos_alert", alertPayload);

      // Se há uma corrida ativa, também notifica o outro participante
      if (rideInfo) {
        const otherUserId = userId === rideInfo.passengerId ? rideInfo.driverId : rideInfo.passengerId;
        if (otherUserId) {
          emitToUser(otherUserId, "sos_alert", { ...alertPayload, fromParticipant: true });
        }
      }
    } catch {
      // Socket pode não estar disponível — log já foi feito acima
    }

    res.json({
      success: true,
      message: "SOS enviado com sucesso. Nossa equipe foi notificada e entrará em contato imediatamente.",
      supportPhone: process.env.SUPPORT_PHONE ?? "0800-ZeroRisco",
    });
  });

  export default router;
  