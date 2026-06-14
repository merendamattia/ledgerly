import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { requireAuth } from "../middlewares/auth.ts";
import { computeNetWorth } from "../../services/valuation.ts";
import { snapshotRepository } from "../../repositories/snapshot.ts";
import { transactionRepository } from "../../repositories/transaction.ts";
import { serializeTransaction } from "../../utils/serialize.ts";
import { dashboardQuerySchema } from "../../schemas/index.ts";
import type { AppEnv } from "../types.ts";

function monthKey(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

export const dashboardRoutes = new Hono<AppEnv>()
  .use("*", requireAuth)
  .get("/", zValidator("query", dashboardQuerySchema), async (c) => {
  const months = c.req.valid("query").months ?? 6;
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const rangeStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (months - 1), 1));

  const [netWorth, snapshots, cashFlowMonth, recent, rangeTx] = await Promise.all([
    computeNetWorth(),
    snapshotRepository.history(180),
    transactionRepository.sumByDirection(monthStart),
    transactionRepository.recent(8),
    transactionRepository.list({ from: rangeStart }),
  ]);

  // Build an income/expense series (one bucket per month in the range).
  const buckets = new Map<string, { month: string; income: number; expense: number }>();
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    buckets.set(monthKey(d), { month: monthKey(d), income: 0, expense: 0 });
  }
  for (const t of rangeTx) {
    const bucket = buckets.get(monthKey(t.date));
    if (!bucket) continue;
    if (t.direction === "INCOME") bucket.income += Number(t.amount);
    else bucket.expense += Number(t.amount);
  }

  // Income/expense totals per category across the whole range (drives the
  // by-category breakdown charts on the transactions page).
  const categories = new Map<
    string,
    { categoryId: string | null; name: string; color: string | null; income: number; expense: number }
  >();
  for (const t of rangeTx) {
    const key = t.category?.id ?? "__uncategorized__";
    const entry =
      categories.get(key) ??
      {
        categoryId: t.category?.id ?? null,
        name: t.category?.name ?? "Uncategorized",
        color: t.category?.color ?? null,
        income: 0,
        expense: 0,
      };
    if (t.direction === "INCOME") entry.income += Number(t.amount);
    else entry.expense += Number(t.amount);
    categories.set(key, entry);
  }

  return c.json({
    netWorth,
    snapshots: snapshots.map((s) => ({
      date: s.date,
      totalValue: Number(s.totalValue),
      breakdown: s.breakdown,
    })),
    cashFlowMonth,
    cashFlowSeries: [...buckets.values()],
    categoryBreakdown: [...categories.values()],
    recentTransactions: recent.map(serializeTransaction),
  });
});
