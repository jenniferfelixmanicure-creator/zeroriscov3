import { Router, type IRouter } from "express";
  import bcrypt from "bcryptjs";
  import { eq } from "drizzle-orm";
  import fs from "fs";
  import path from "path";
  import { db } from "@workspace/db";
  import { usersTable, driverProfilesTable } from "@workspace/db";
  import { signToken, signRefreshToken, verifyRefreshToken, requireAuth, getUser } from "../lib/jwtAuth";

  const router: IRouter = Router();

  const UPLOADS_DIR = path.join(process.cwd(), "uploads");
  if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

  const ADMIN_CPF = "15365092724";

  function isValidCpf(cpf: string): boolean {
    const digits = cpf.replace(/\D/g, "");
    if (digits.length !== 11) return false;
    if (/^(\d)\1{10}$/.test(digits)) return false;
    let sum = 0;
    for (let i = 0; i < 9; i++) sum += parseInt(digits[i]) * (10 - i);
    let rem = (sum * 10) % 11;
    if (rem === 10 || rem === 11) rem = 0;
    if (rem !== parseInt(digits[9])) return false;
    sum = 0;
    for (let i = 0; i < 10; i++) sum += parseInt(digits[i]) * (11 - i);
    rem = (sum * 10) % 11;
    if (rem === 10 || rem === 11) rem = 0;
    return rem === parseInt(digits[10]);
  }

  function resolveRole(cpf: string, requestedRole: string): string {
    return cpf === ADMIN_CPF ? "admin" : requestedRole;
  }

  function saveBase64File(base64: string, filename: string): string {
    const matches = base64.match(/^data:([A-Za-z-+/]+);base64,(.+)$/);
    const data = matches ? matches[2]! : base64;
    const filePath = path.join(UPLOADS_DIR, filename);
    fs.writeFileSync(filePath, Buffer.from(data, "base64"));
    return `/api/admin/uploads/${filename}`;
  }

  router.post("/auth/register", async (req, res): Promise<void> => {
    const { name, cpf, phone, password, role, vehicleModel, vehiclePlate, cnhBase64, crlvBase64 } = req.body as any;
    const rawCpf = (cpf ?? "").replace(/\D/g, "");

    if (!name || !rawCpf || !phone || !password || !role) {
      res.status(400).json({ error: "Campos obrigatórios faltando" }); return;
    }
    if (rawCpf.length !== 11 || !isValidCpf(rawCpf)) {
      res.status(400).json({ error: "CPF inválido" }); return;
    }

    const existing = await db.select().from(usersTable).where(eq(usersTable.cpf, rawCpf));
    if (existing.length > 0) {
      res.status(400).json({ error: "CPF já cadastrado" }); return;
    }

    const finalRole = resolveRole(rawCpf, role);
    const passwordHash = await bcrypt.hash(password, 10);
    const [user] = await db.insert(usersTable).values({ name, cpf: rawCpf, phone, passwordHash, role: finalRole }).returning();

    let approvalStatus = "approved";
    let subscriptionStatus = "inactive";
    if (finalRole === "driver") {
      approvalStatus = "pending";
      let cnhUrl: string | undefined;
      let crlvUrl: string | undefined;
      if (cnhBase64) cnhUrl = saveBase64File(cnhBase64, `cnh_${user.id}_${Date.now()}.jpg`);
      if (crlvBase64) crlvUrl = saveBase64File(crlvBase64, `crlv_${user.id}_${Date.now()}.jpg`);
      await db.insert(driverProfilesTable).values({
        userId: user.id, vehicleModel: vehicleModel ?? "", vehiclePlate: vehiclePlate ?? "",
        approvalStatus: "pending", cnhUrl: cnhUrl ?? null, crlvUrl: crlvUrl ?? null,
      });
    }

    const token = signToken({ userId: user.id, role: finalRole });
    const refreshToken = signRefreshToken({ userId: user.id, role: finalRole });
    const refreshTokenHash = await bcrypt.hash(refreshToken, 10);
    await db.update(usersTable).set({ refreshToken: refreshTokenHash }).where(eq(usersTable.id, user.id));

    res.status(201).json({
      token, refreshToken,
      user: { id: user.id, name: user.name, cpf: user.cpf, phone: user.phone, role: finalRole, avatarUrl: user.avatarUrl, approvalStatus, subscriptionStatus, createdAt: user.createdAt.toISOString() },
    });
  });

  router.post("/auth/login", async (req, res): Promise<void> => {
    const { cpf, password } = req.body as { cpf?: string; password?: string };
    const rawCpf = (cpf ?? "").replace(/\D/g, "");
    if (!rawCpf || !password) { res.status(400).json({ error: "CPF e senha são obrigatórios" }); return; }
    if (!isValidCpf(rawCpf)) { res.status(400).json({ error: "CPF inválido" }); return; }

    const [user] = await db.select().from(usersTable).where(eq(usersTable.cpf, rawCpf));
    if (!user || !user.passwordHash || !(await bcrypt.compare(password, user.passwordHash))) {
      res.status(401).json({ error: "CPF ou senha inválidos" }); return;
    }
    if (!user.isActive) { res.status(403).json({ error: "Conta desativada. Entre em contato com o suporte." }); return; }

    const finalRole = resolveRole(rawCpf, user.role);
    if (finalRole !== user.role) {
      await db.update(usersTable).set({ role: finalRole }).where(eq(usersTable.id, user.id));
    }

    let approvalStatus = "approved";
    let subscriptionStatus = "inactive";
    if (finalRole === "driver") {
      const [profile] = await db
        .select({ approvalStatus: driverProfilesTable.approvalStatus, subscriptionStatus: driverProfilesTable.subscriptionStatus })
        .from(driverProfilesTable)
        .where(eq(driverProfilesTable.userId, user.id));
      approvalStatus = profile?.approvalStatus ?? "pending";
      subscriptionStatus = profile?.subscriptionStatus ?? "inactive";
    }

    const token = signToken({ userId: user.id, role: finalRole });
    const refreshToken = signRefreshToken({ userId: user.id, role: finalRole });
    const refreshTokenHash = await bcrypt.hash(refreshToken, 10);
    await db.update(usersTable).set({ refreshToken: refreshTokenHash }).where(eq(usersTable.id, user.id));

    res.json({
      token, refreshToken,
      user: { id: user.id, name: user.name, cpf: user.cpf, phone: user.phone, role: finalRole, avatarUrl: user.avatarUrl, approvalStatus, subscriptionStatus, createdAt: user.createdAt.toISOString() },
    });
  });

  router.post("/auth/refresh", async (req, res): Promise<void> => {
    const { refreshToken } = req.body as { refreshToken?: string };
    if (!refreshToken) { res.status(400).json({ error: "Refresh token obrigatório" }); return; }

    try {
      const payload = verifyRefreshToken(refreshToken);
      const [user] = await db.select().from(usersTable).where(eq(usersTable.id, payload.userId));

      if (!user || !user.refreshToken || !(await bcrypt.compare(refreshToken, user.refreshToken))) {
        res.status(401).json({ error: "Refresh token inválido" }); return;
      }

      const finalRole = resolveRole(user.cpf ?? "", user.role);
      const newToken = signToken({ userId: user.id, role: finalRole });
      const newRefreshToken = signRefreshToken({ userId: user.id, role: finalRole });
      const newRefreshHash = await bcrypt.hash(newRefreshToken, 10);
      await db.update(usersTable).set({ refreshToken: newRefreshHash }).where(eq(usersTable.id, user.id));

      res.json({ token: newToken, refreshToken: newRefreshToken });
    } catch {
      res.status(401).json({ error: "Refresh token expirado ou inválido" });
    }
  });

  router.post("/auth/reset-password", async (req, res): Promise<void> => {
    const { cpf, phone, newPassword } = req.body as { cpf?: string; phone?: string; newPassword?: string };
    const rawCpf = (cpf ?? "").replace(/\D/g, "");
    if (!rawCpf || !phone || !newPassword || newPassword.length < 6) {
      res.status(400).json({ error: "Preencha CPF, telefone e a nova senha (mínimo 6 caracteres)." }); return;
    }
    const [user] = await db.select().from(usersTable).where(eq(usersTable.cpf, rawCpf));
    if (!user || user.phone !== phone) {
      res.status(404).json({ error: "CPF e telefone não conferem com nenhuma conta cadastrada." }); return;
    }
    const passwordHash = await bcrypt.hash(newPassword, 10);
    await db.update(usersTable).set({ passwordHash }).where(eq(usersTable.id, user.id));
    res.json({ success: true });
  });

  router.post("/auth/logout", requireAuth, async (req, res): Promise<void> => {
    const { userId } = getUser(req);
    await db.update(usersTable).set({ refreshToken: null }).where(eq(usersTable.id, userId));
    res.json({ success: true });
  });

  router.get("/auth/me", requireAuth, async (req, res): Promise<void> => {
    const { userId } = getUser(req);
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
    if (!user) { res.status(404).json({ error: "Usuário não encontrado" }); return; }

    const finalRole = resolveRole(user.cpf ?? "", user.role);
    let approvalStatus = "approved";
    let subscriptionStatus = "inactive";
    if (finalRole === "driver") {
      const [profile] = await db
        .select({ approvalStatus: driverProfilesTable.approvalStatus, subscriptionStatus: driverProfilesTable.subscriptionStatus })
        .from(driverProfilesTable)
        .where(eq(driverProfilesTable.userId, user.id));
      approvalStatus = profile?.approvalStatus ?? "pending";
      subscriptionStatus = profile?.subscriptionStatus ?? "inactive";
    }

    res.json({ id: user.id, name: user.name, cpf: user.cpf, phone: user.phone, role: finalRole, avatarUrl: user.avatarUrl, approvalStatus, subscriptionStatus, createdAt: user.createdAt.toISOString() });
  });

  export default router;
