import http from "http";
  import app from "./app";
  import { logger } from "./lib/logger";
  import { initSocket } from "./lib/socket";
  import { db } from "@workspace/db";
  import { categoriesTable } from "@workspace/db";
  import { runMigrations } from "./lib/migrate";

  const rawPort = process.env["PORT"] || "5000";
  const port = Number(rawPort);
  if (Number.isNaN(port) || port <= 0) throw new Error(`Invalid PORT value: "${rawPort}"`);

  async function seedCategoriesIfEmpty() {
    try {
      const existing = await db.select().from(categoriesTable);
      if (existing.length > 0) return;
      await db.insert(categoriesTable).values([
        { name: "Moto",          description: "Rápido e econômico para curtas distâncias", icon: "motorcycle", baseFare: "2.50", pricePerKm: "1.20", pricePerMinute: "0.20", minFare: "5.00",  multiplier: "1.00" },
        { name: "Básico",        description: "Carros populares com ótimo custo-benefício", icon: "car",       baseFare: "3.50", pricePerKm: "1.80", pricePerMinute: "0.35", minFare: "7.00",  multiplier: "1.00" },
        { name: "Intermediário", description: "Conforto superior para o seu dia a dia",     icon: "car-sport", baseFare: "5.00", pricePerKm: "2.50", pricePerMinute: "0.50", minFare: "10.00", multiplier: "1.00" },
        { name: "VIP",           description: "Veículos premium com motoristas avaliados",  icon: "diamond",   baseFare: "8.00", pricePerKm: "4.00", pricePerMinute: "0.80", minFare: "18.00", multiplier: "1.00" },
      ]);
      logger.info("✅ 4 categorias criadas: Moto, Básico, Intermediário, VIP");
    } catch (err) {
      logger.warn({ err }, "Seed de categorias ignorado");
    }
  }

  const server = http.createServer(app);
  initSocket(server);

  server.listen(port, async () => {
    logger.info({ port }, "Server listening com Socket.IO");
    try {
      await runMigrations(logger);
      await seedCategoriesIfEmpty();
    } catch (err) {
      logger.error({ err }, "Falha no startup (migrations/seed) — servidor continua rodando");
    }
  });
  