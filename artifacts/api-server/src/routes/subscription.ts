import { Router, type IRouter } from "express";
  import { eq } from "drizzle-orm";
  import { db } from "@workspace/db";
  import { driverProfilesTable } from "@workspace/db";
  import { requireAuth, getUser } from "../lib/jwtAuth";

  const router: IRouter = Router();

  const MONTHLY_FEE = 80.00;
  const PIX_KEY = process.env.PIX_KEY ?? "contato@zerorisco.com.br";

  router.get("/subscription", requireAuth, async (req, res): Promise<void> => {
    const { userId } = getUser(req);

    const [profile] = await db.select().from(driverProfilesTable).where(eq(driverProfilesTable.userId, userId));
    if (!profile) { res.status(404).json({ error: "Perfil de motorista não encontrado" }); return; }

    const now = new Date();
    const isActive =
      profile.subscriptionStatus === "active" &&
      profile.subscriptionExpiresAt != null &&
      profile.subscriptionExpiresAt > now;

    const daysLeft = isActive && profile.subscriptionExpiresAt
      ? Math.ceil((profile.subscriptionExpiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      : 0;

    res.json({
      status: profile.subscriptionStatus,
      isActive,
      expiresAt: profile.subscriptionExpiresAt?.toISOString() ?? null,
      daysLeft,
      monthlyFee: MONTHLY_FEE,
      currency: "BRL",
      pixKey: PIX_KEY,
    });
  });

  // Motorista solicita ativação — admin confirma manualmente após verificar pagamento PIX
  router.post("/subscription/request", requireAuth, async (req, res): Promise<void> => {
    const { userId } = getUser(req);

    const [profile] = await db.select().from(driverProfilesTable).where(eq(driverProfilesTable.userId, userId));
    if (!profile) { res.status(404).json({ error: "Perfil de motorista não encontrado" }); return; }

    if (profile.subscriptionStatus === "active" && profile.subscriptionExpiresAt && profile.subscriptionExpiresAt > new Date()) {
      res.status(400).json({ error: "Assinatura já está ativa", expiresAt: profile.subscriptionExpiresAt.toISOString() });
      return;
    }

    await db.update(driverProfilesTable)
      .set({ subscriptionStatus: "pending_payment" })
      .where(eq(driverProfilesTable.userId, userId));

    res.json({
      success: true,
      message: `Solicitação enviada! Após confirmar o pagamento de R$ ${MONTHLY_FEE.toFixed(2)} via PIX, sua assinatura será ativada em até 24h.`,
      pixKey: PIX_KEY,
      amount: MONTHLY_FEE,
      instructions: [
        `1. Faça um PIX de R$ ${MONTHLY_FEE.toFixed(2)} para a chave: ${PIX_KEY}`,
        "2. Envie o comprovante para o suporte ZeroRisco",
        "3. Sua conta será ativada em até 24 horas úteis",
      ],
    });
  });

  // Admin ativa assinatura de um motorista (rota protegida por role admin)
  router.post("/subscription/activate/:driverUserId", requireAuth, async (req, res): Promise<void> => {
    const { role } = getUser(req);
    if (role !== "admin") { res.status(403).json({ error: "Acesso negado" }); return; }

    const driverUserId = parseInt(String(req.params.driverUserId), 10);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    const [updated] = await db.update(driverProfilesTable)
      .set({ subscriptionStatus: "active", subscriptionExpiresAt: expiresAt })
      .where(eq(driverProfilesTable.userId, driverUserId))
      .returning();

    if (!updated) { res.status(404).json({ error: "Motorista não encontrado" }); return; }

    res.json({
      success: true,
      message: `Assinatura ativada com sucesso para o motorista ID ${driverUserId}`,
      expiresAt: expiresAt.toISOString(),
      daysActive: 30,
    });
  });

  // Admin lista motoristas com assinatura pendente
  router.get("/subscription/pending", requireAuth, async (req, res): Promise<void> => {
    const { role } = getUser(req);
    if (role !== "admin") { res.status(403).json({ error: "Acesso negado" }); return; }

    const pending = await db.select().from(driverProfilesTable)
      .where(eq(driverProfilesTable.subscriptionStatus, "pending_payment"));

    res.json({ total: pending.length, drivers: pending.map(p => ({
      id: p.id, userId: p.userId, vehicleModel: p.vehicleModel,
      vehiclePlate: p.vehiclePlate, status: p.subscriptionStatus,
    }))});
  });

  export default router;
  