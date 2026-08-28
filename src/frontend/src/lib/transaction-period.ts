export const CUSTOM_TRANSACTION_PERIOD = "custom";
export const MAX_TRANSACTION_PAGE_SIZE = 5_000;

export interface TransactionDateRange {
  from?: string;
  to?: string;
}

export interface TransactionSummaryRows {
  direction: "INCOME" | "EXPENSE";
  amount: number;
}

export interface TransactionCategoryRow extends TransactionSummaryRows {
  category?: { id: string; name: string } | null;
}

export interface TransactionCategorySummary {
  income: Record<string, number>;
  expenses: Record<string, number>;
  labels: Record<string, string>;
}

export interface TransactionSummary {
  income: number;
  expenses: number;
  net: number;
}

/** Returns whether a period needs the complete-result query instead of page loading. */
export function shouldLoadCompleteTransactionResults(period: string): boolean {
  return period !== "all";
}

/** Loads every page from an offset-based endpoint without exceeding its page limit. */
export async function loadCompletePages<T>(
  fetchPage: (offset: number, limit: number) => Promise<T[]>,
  pageSize = MAX_TRANSACTION_PAGE_SIZE,
): Promise<T[]> {
  const rows: T[] = [];
  let offset = 0;

  while (true) {
    const page = await fetchPage(offset, pageSize);
    rows.push(...page);
    if (page.length < pageSize) return rows;
    offset += page.length;
  }
}

/** Sums already-filtered transaction rows for signed tag totals and regression checks. */
export function summarizeTransactionRows(rows: readonly TransactionSummaryRows[]): TransactionSummary {
  let income = 0;
  let expenses = 0;
  for (const row of rows) {
    if (row.direction === "INCOME") income += row.amount;
    else expenses += row.amount;
  }
  return { income, expenses, net: income - expenses };
}

/** Groups filtered transactions into the category totals consumed by the period donut switch. */
export function summarizeTransactionCategories(
  rows: readonly TransactionCategoryRow[],
): TransactionCategorySummary {
  const summary: TransactionCategorySummary = { income: {}, expenses: {}, labels: {} };
  for (const row of rows) {
    const key = row.category?.id ?? "uncategorized";
    summary.labels[key] = row.category?.name || "Uncategorized";
    const target = row.direction === "INCOME" ? summary.income : summary.expenses;
    target[key] = (target[key] ?? 0) + row.amount;
  }
  return summary;
}

function clampToToday(value: string | undefined, today: string): string | undefined {
  if (!value) return undefined;
  return value > today ? today : value;
}

/** Resolves a transaction period into the inclusive date filters used by the API. */
export function resolveTransactionRange(
  period: string,
  today: string,
  customFrom?: string,
  customTo?: string,
): TransactionDateRange {
  if (period === CUSTOM_TRANSACTION_PERIOD) {
    const from = clampToToday(customFrom, today);
    const requestedTo = clampToToday(customTo, today) ?? today;
    return {
      from: from && from > requestedTo ? requestedTo : from,
      to: requestedTo,
    };
  }

  if (period === "all") return { from: undefined, to: today };

  const match = /^(\d{4})-(\d{2})$/.exec(period);
  if (!match) return { from: undefined, to: today };

  const year = Number(match[1]);
  const month = Number(match[2]);
  const monthStart = new Date(year, month - 1, 1);
  const monthEnd = new Date(year, month, 0);
  const to = [
    monthEnd.getFullYear(),
    String(monthEnd.getMonth() + 1).padStart(2, "0"),
    String(monthEnd.getDate()).padStart(2, "0"),
  ].join("-");

  return {
    from: [year, String(monthStart.getMonth() + 1).padStart(2, "0"), "01"].join("-"),
    to: to > today ? today : to,
  };
}
