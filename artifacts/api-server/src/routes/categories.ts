import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { categoriesTable } from "@workspace/db";

const router: IRouter = Router();

router.get("/categories", async (_req, res): Promise<void> => {
  const cats = await db.select().from(categoriesTable).orderBy(categoriesTable.id);
  res.json(
    cats.map((c) => ({
      id: c.id,
      name: c.name,
      description: c.description,
      icon: c.icon,
      baseFare: Number(c.baseFare),
      pricePerKm: Number(c.pricePerKm),
      pricePerMinute: Number(c.pricePerMinute),
      minFare: Number(c.minFare),
      multiplier: Number(c.multiplier),
    }))
  );
});

export default router;
