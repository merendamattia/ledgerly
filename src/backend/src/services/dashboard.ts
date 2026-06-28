import { snapshotRepository } from "../repositories/snapshot.ts";
import { transactionRepository } from "../repositories/transaction.ts";
import { serializeTransaction } from "../utils/serialize.ts";
import { computeNetWorth } from "./valuation.ts";

/**
 * Formats a UTC date as the dashboard's monthly bucket key.
 */
function monthKey(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

interface CashFlowPoint {
  month: string;
  income: number;
  expense: number;
}

interface CategoryBreakdown {
  categoryId: string | null;
  name: string;
  income: number;
  expense: number;
}

type DashboardTransaction = {
  date: Date;
  amount: unknown;
  direction: "INCOME" | "EXPENSE";
  category?: { id: string; name: string } | null;
};

/**
 * Returns the current UTC month boundaries used by the Overview aggregates.
 */
export function dashboardMonthRange(now = new Date()) {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const todayInclusive = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const nextStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  return { start, todayInclusive, nextStart };
}

/**
 * Creates a zeroed category aggregate for a transaction category.
 */
function emptyCategory(category?: { id: string; name: string } | null): CategoryBreakdown {
  return {
    categoryId: category?.id ?? null,
    name: category?.name ?? "Uncategorized",
    income: 0,
    expense: 0,
  };
}

/**
 * Adds one transaction amount to an income/expense category aggregate.
 */
function addTransactionToBreakdown(
  breakdown: Map<string, CategoryBreakdown>,
  transaction: {
    amount: unknown;
    direction: "INCOME" | "EXPENSE";
    category?: { id: string; name: string } | null;
  },
): void {
  const key = transaction.category?.id ?? "__uncategorized__";
  const entry = breakdown.get(key) ?? emptyCategory(transaction.category);
  if (transaction.direction === "INCOME") entry.income += Number(transaction.amount);
  else entry.expense += Number(transaction.amount);
  breakdown.set(key, entry);
}

/**
 * Builds the trailing month buckets used by the dashboard cash-flow chart.
 */
function buildCashFlowBuckets(months: number, now: Date): Map<string, CashFlowPoint> {
  const buckets = new Map<string, CashFlowPoint>();
  for (let i = months - 1; i >= 0; i--) {
    const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    const month = monthKey(date);
    buckets.set(month, { month, income: 0, expense: 0 });
  }
  return buckets;
}

/**
 * Aggregates transactions into the Overview cash-flow series and category maps.
 */
export function aggregateDashboardTransactions(
  transactions: DashboardTransaction[],
  months: number,
  now = new Date(),
) {
  const monthRange = dashboardMonthRange(now);
  const buckets = buildCashFlowBuckets(months, now);
  const categoryBreakdown = new Map<string, CategoryBreakdown>();
  const categoryBreakdownMonth = new Map<string, CategoryBreakdown>();

  for (const transaction of transactions) {
    if (transaction.date > monthRange.todayInclusive) continue;

    const bucket = buckets.get(monthKey(transaction.date));
    if (bucket) {
      if (transaction.direction === "INCOME") bucket.income += Number(transaction.amount);
      else bucket.expense += Number(transaction.amount);
    }

    addTransactionToBreakdown(categoryBreakdown, transaction);
    if (transaction.date >= monthRange.start && transaction.date < monthRange.nextStart) {
      addTransactionToBreakdown(categoryBreakdownMonth, transaction);
    }
  }

  return {
    cashFlowSeries: [...buckets.values()],
    categoryBreakdown: [...categoryBreakdown.values()],
    categoryBreakdownMonth: [...categoryBreakdownMonth.values()],
  };
}

/**
 * Composes the overview dashboard payload from net worth, snapshots, cash flow,
 * category breakdowns, and recent transactions.
 */
export async function getDashboardData(months = 6) {
  const now = new Date();
  const monthRange = dashboardMonthRange(now);
  const rangeStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (months - 1), 1));

  const [netWorth, snapshots, cashFlowMonth, recent, rangeTx] = await Promise.all([
    computeNetWorth(),
    snapshotRepository.history(180),
    transactionRepository.sumByDirection(monthRange.start, monthRange.todayInclusive),
    transactionRepository.list({ to: monthRange.todayInclusive, limit: 8 }),
    transactionRepository.list({ from: rangeStart, to: monthRange.todayInclusive }),
  ]);

  const aggregates = aggregateDashboardTransactions(rangeTx, months, now);

  return {
    netWorth,
    snapshots: snapshots.map((snapshot) => ({
      date: snapshot.date,
      totalValue: Number(snapshot.totalValue),
      breakdown: snapshot.breakdown,
    })),
    cashFlowMonth,
    cashFlowSeries: aggregates.cashFlowSeries,
    categoryBreakdown: aggregates.categoryBreakdown,
    categoryBreakdownMonth: aggregates.categoryBreakdownMonth,
    recentTransactions: recent.map(serializeTransaction),
  };
}
