import { Router, type IRouter } from "express";
  import { and, eq } from "drizzle-orm";
  import { db } from "@workspace/db";
  import { savedAddressesTable } from "@workspace/db";
  import { requireAuth, getUser } from "../lib/jwtAuth";

  const router: IRouter = Router();

  router.get("/saved-addresses", requireAuth, async (req, res): Promise<void> => {
    const { userId } = getUser(req);
    const addresses = await db.select().from(savedAddressesTable)
      .where(eq(savedAddressesTable.userId, userId))
      .orderBy(savedAddressesTable.createdAt);
    res.json(addresses.map(a => ({
      id: a.id, label: a.label, address: a.address,
      lat: Number(a.lat), lng: Number(a.lng), isDefault: a.isDefault,
      createdAt: a.createdAt.toISOString(),
    })));
  });

  router.post("/saved-addresses", requireAuth, async (req, res): Promise<void> => {
    const { userId } = getUser(req);
    const { label, address, lat, lng, isDefault } = req.body;
    if (!label || !address || !lat || !lng) {
      res.status(400).json({ error: "label, address, lat e lng são obrigatórios" }); return;
    }
    // Se isDefault=true, remove default dos outros
    if (isDefault) {
      await db.update(savedAddressesTable).set({ isDefault: false }).where(eq(savedAddressesTable.userId, userId));
    }
    const [created] = await db.insert(savedAddressesTable).values({
      userId, label, address, lat: String(lat), lng: String(lng), isDefault: !!isDefault,
    }).returning();
    res.status(201).json({ id: created.id, label: created.label, address: created.address, lat: Number(created.lat), lng: Number(created.lng), isDefault: created.isDefault, createdAt: created.createdAt.toISOString() });
  });

  router.patch("/saved-addresses/:id", requireAuth, async (req, res): Promise<void> => {
    const { userId } = getUser(req);
    const id = parseInt(String(req.params.id), 10);
    const { label, address, lat, lng, isDefault } = req.body;
    if (isDefault) {
      await db.update(savedAddressesTable).set({ isDefault: false }).where(eq(savedAddressesTable.userId, userId));
    }
    const updates: Partial<typeof savedAddressesTable.$inferInsert> = {};
    if (label !== undefined) updates.label = label;
    if (address !== undefined) updates.address = address;
    if (lat !== undefined) updates.lat = String(lat);
    if (lng !== undefined) updates.lng = String(lng);
    if (isDefault !== undefined) updates.isDefault = isDefault;
    const [updated] = await db.update(savedAddressesTable).set(updates)
      .where(and(eq(savedAddressesTable.id, id), eq(savedAddressesTable.userId, userId)))
      .returning();
    if (!updated) { res.status(404).json({ error: "Endereço não encontrado" }); return; }
    res.json({ id: updated.id, label: updated.label, address: updated.address, lat: Number(updated.lat), lng: Number(updated.lng), isDefault: updated.isDefault });
  });

  router.delete("/saved-addresses/:id", requireAuth, async (req, res): Promise<void> => {
    const { userId } = getUser(req);
    const id = parseInt(String(req.params.id), 10);
    await db.delete(savedAddressesTable)
      .where(and(eq(savedAddressesTable.id, id), eq(savedAddressesTable.userId, userId)));
    res.json({ success: true });
  });

  export default router;
  