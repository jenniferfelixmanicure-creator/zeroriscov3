import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import fs from "fs";
import path from "path";
import { db } from "@workspace/db";
import { usersTable, driverProfilesTable } from "@workspace/db";
import { signToken, requireAuth, getUser } from "../lib/jwtAuth";

const router: IRouter = Router();

const UPLOADS_DIR = path.join(process.cwd(), "uploads");
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

function saveBase64File(base64: string, filename: string): string {
  const matches = base64.match(/^data:([A-Za-z-+/]+);base64,(.+)$/);
  const data = matches ? matches[2]! : base64;
  const filePath = path.join(UPLOADS_DIR, filename);
  fs.writeFileSync(filePath, Buffer.from(data, "base64"));
  return `/api/admin/uploads/${filename}`;
}

router.post("/auth/register", async (req, res): Promise<void> => {
  const { name, cpf, phone, password, role, vehicleModel, vehiclePlate, cnhBase64, crlvBase64 } =
    req.body as {
      name?: string;
      cpf?: string;
      phone?: string;
      password?: string;
      role?: string;
      vehicleModel?: string;
      vehiclePlate?: string;
      cnhBase64?: string;
      crlvBase64?: string;
    };

  const rawCpf = (cpf ?? "").replace(/\D/g, "");

  if (!name || !rawCpf || !phone || !password || !role) {
    res.status(400).json({ error: "Campos obrigatórios faltando" });
    return;
  }

  if (rawCpf.length !== 11) {
    res.status(400).json({ error: "CPF inválido" });
    return;
  }

  const existing = await db.select().from(usersTable).where(eq(usersTable.cpf, rawCpf));
  if (existing.length > 0) {
    res.status(400).json({ error: "CPF já cadastrado" });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const [user] = await db
    .insert(usersTable)
    .values({ name, cpf: rawCpf, phone, passwordHash, role })
    .returning();

  let approvalStatus = "approved";

  if (role === "driver") {
    approvalStatus = "pending";
    let cnhUrl: string | undefined;
    let crlvUrl: string | undefined;

    if (cnhBase64) {
      cnhUrl = saveBase64File(cnhBase64, `cnh_${user.id}_${Date.now()}.jpg`);
    }
    if (crlvBase64) {
      crlvUrl = saveBase64File(crlvBase64, `crlv_${user.id}_${Date.now()}.jpg`);
    }

    await db.insert(driverProfilesTable).values({
      userId: user.id,
      vehicleModel: vehicleModel ?? "",
      vehiclePlate: vehiclePlate ?? "",
      approvalStatus: "pending",
      cnhUrl: cnhUrl ?? null,
      crlvUrl: crlvUrl ?? null,
    });
  }

  const token = signToken({ userId: user.id, role: user.role });

  res.status(201).json({
    token,
    user: {
      id: user.id,
      name: user.name,
      cpf: user.cpf,
      phone: user.phone,
      role: user.role,
      avatarUrl: user.avatarUrl,
      approvalStatus,
      createdAt: user.createdAt.toISOString(),
    },
  });
});

router.post("/auth/login", async (req, res): Promise<void> => {
  const { cpf, password } = req.body as { cpf?: string; password?: string };
  const rawCpf = (cpf ?? "").replace(/\D/g, "");

  if (!rawCpf || !password) {
    res.status(400).json({ error: "CPF e senha são obrigatórios" });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.cpf, rawCpf));

  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    res.status(401).json({ error: "CPF ou senha inválidos" });
    return;
  }

  if (!user.isActive) {
    res.status(403).json({ error: "Conta desativada. Entre em contato com o suporte." });
    return;
  }

  let approvalStatus = "approved";
  if (user.role === "driver") {
    const [profile] = await db
      .select({ approvalStatus: driverProfilesTable.approvalStatus })
      .from(driverProfilesTable)
      .where(eq(driverProfilesTable.userId, user.id));
    approvalStatus = profile?.approvalStatus ?? "pending";
  }

  const token = signToken({ userId: user.id, role: user.role });

  res.json({
    token,
    user: {
      id: user.id,
      name: user.name,
      cpf: user.cpf,
      phone: user.phone,
      role: user.role,
      avatarUrl: user.avatarUrl,
      approvalStatus,
      createdAt: user.createdAt.toISOString(),
    },
  });
});

router.get("/auth/me", requireAuth, async (req, res): Promise<void> => {
  const { userId } = getUser(req);
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));

  if (!user) {
    res.status(404).json({ error: "Usuário não encontrado" });
    return;
  }

  let approvalStatus = "approved";
  if (user.role === "driver") {
    const [profile] = await db
      .select({ approvalStatus: driverProfilesTable.approvalStatus, rejectionReason: driverProfilesTable.rejectionReason })
      .from(driverProfilesTable)
      .where(eq(driverProfilesTable.userId, user.id));
    approvalStatus = profile?.approvalStatus ?? "pending";
  }

  res.json({
    id: user.id,
    name: user.name,
    cpf: user.cpf,
    phone: user.phone,
    role: user.role,
    avatarUrl: user.avatarUrl,
    approvalStatus,
    createdAt: user.createdAt.toISOString(),
  });
});

export default router;
