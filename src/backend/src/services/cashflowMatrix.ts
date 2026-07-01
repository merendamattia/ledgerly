import { prisma } from "../core/db.ts";
import { settingsRepository } from "../repositories/settings.ts";

export interface CashflowRow {
  id: string; // categoryId | "__uncategorized__"
  label: string; // category name
  values: number[]; // signed-positive amount per month column, in base currency
}

export interface CashflowMatrix {
  baseCurrency: string;
  months: string[]; // yyyy-mm-01, ascending — one column per month
  expense: CashflowRow[]; // ordered by total spend, descending
  income: CashflowRow[]; // ordered by total income, descending
}

/** yyyy-mm-01 key for the month a date falls in (UTC, matches @db.Date storage). */
function monthKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-01`;
}

/**
 * Wide cash-flow matrix: expense/income categories (rows) × month columns.
 * Each cell is the summed transaction amount for that category in that month.
 * Totals, per-year averages and the balance/savings-rate rows are derived by
 * the frontend from these monthly series.
 */
export async function computeCashflowMatrix(): Promise<CashflowMatrix> {
  const [baseCurrency, txs] = await Promise.all([
    settingsRepository.baseCurrency(),
    prisma.transaction.findMany({ include: { category: true }, orderBy: { date: "asc" } }),
  ]);
  if (txs.length === 0) return { baseCurrency, months: [], expense: [], income: [] };

  // Month columns: first transaction's month through the current month.
  const first = txs[0].date;
  const now = new Date();
  const index = new Map<string, number>();
  const months: string[] = [];
  const end = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1);
  for (
    let m = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth(), 1));
    m.getTime() <= end;
    m.setUTCMonth(m.getUTCMonth() + 1)
  ) {
    index.set(monthKey(m), months.length);
    months.push(monthKey(m));
  }

  const sum = (values: number[]) => values.reduce((acc, v) => acc + v, 0);

  const build = (direction: "INCOME" | "EXPENSE"): CashflowRow[] => {
    const byCategory = new Map<string, CashflowRow>();
    for (const t of txs) {
      if (t.direction !== direction) continue;
      const i = index.get(monthKey(t.date));
      if (i == null) continue;
      const id = t.category?.id ?? "__uncategorized__";
      let row = byCategory.get(id);
      if (!row) {
        const name = t.category?.name ?? "Uncategorized";
        const label = t.category?.emoji ? `${t.category.emoji} ${name}` : name;
        row = { id, label, values: Array(months.length).fill(0) };
        byCategory.set(id, row);
      }
      row.values[i] += Number(t.amount);
    }
    // Drop categories that are zero in every month (no real activity → noise).
    return [...byCategory.values()]
      .filter((row) => row.values.some((v) => v !== 0))
      .sort((a, b) => sum(b.values) - sum(a.values));
  };

  return { baseCurrency, months, expense: build("EXPENSE"), income: build("INCOME") };
}
