import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db } from "@workspace/db";
import { walletTransactionsTable, ridesTable } from "@workspace/db";
import { requireAuth, getUser } from "../lib/jwtAuth";

const router: IRouter = Router();

router.get("/wallet", requireAuth, async (req, res): Promise<void> => {
  const { userId } = getUser(req);

  const transactions = await db
    .select()
    .from(walletTransactionsTable)
    .where(eq(walletTransactionsTable.userId, userId));

  const credits = transactions
    .filter((t) => t.type === "credit")
    .reduce((sum, t) => sum + Number(t.amount), 0);

  const debits = transactions
    .filter((t) => t.type === "debit")
    .reduce((sum, t) => sum + Number(t.amount), 0);

  const totalRides = await db
    .select()
    .from(ridesTable)
    .where(eq(ridesTable.passengerId, userId));

  const completedRides = totalRides.filter((r) => r.status === "completed");

  res.json({
    balance: Math.round((credits - debits) * 100) / 100,
    totalSpent: Math.round(debits * 100) / 100,
    totalRides: completedRides.length,
  });
});

router.get("/wallet/transactions", requireAuth, async (req, res): Promise<void> => {
  const { userId } = getUser(req);

  const transactions = await db
    .select()
    .from(walletTransactionsTable)
    .where(eq(walletTransactionsTable.userId, userId))
    .orderBy(walletTransactionsTable.createdAt);

  res.json(
    transactions.reverse().map((t) => ({
      id: t.id,
      type: t.type,
      amount: Number(t.amount),
      description: t.description,
      createdAt: t.createdAt.toISOString(),
    }))
  );
});

export default router;
