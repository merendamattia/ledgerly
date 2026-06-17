// Formatting helpers shared across the UI.

export function formatMoney(value: number, currency = "EUR"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatNumber(value: number, maximumFractionDigits = 2): string {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits }).format(value);
}

/** Compact currency for tight spaces like chart axes, e.g. "€45k", "€2.0k". */
export function compactMoney(value: number, currency = "EUR"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

/** Hard-truncate a string to `max` characters, appending an ellipsis if cut. */
export function truncate(value: string, max = 25): string {
  return value.length > max ? `${value.slice(0, max).trimEnd()}…` : value;
}

export function formatPercent(value: number): string {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

export function formatDate(value: string | Date): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

export function formatDateTime(value: string | Date): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

/**
 * Elapsed time between a run's start and finish, e.g. "820 ms" / "3.4 s".
 * Returns "—" when the run is still in flight (no finish time).
 */
export function formatDuration(start: string | Date, end?: string | Date | null): string {
  if (!end) return "—";
  const startMs = (typeof start === "string" ? new Date(start) : start).getTime();
  const endMs = (typeof end === "string" ? new Date(end) : end).getTime();
  const ms = endMs - startMs;
  if (ms < 1000) return `${ms} ms`;
  return `${(ms / 1000).toFixed(1)} s`;
}

/** Today's date as an ISO yyyy-mm-dd string (for date inputs). */
export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Numeric date, e.g. "14/06/2026" — compact, used in transaction/list rows. */
export function numericDate(value: string | Date): string {
  const d = typeof value === "string" ? new Date(value) : value;
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  return `${day}/${month}/${d.getFullYear()}`;
}

/** Compact day label with year, e.g. "15 Jun '26" — used on chart axes/rows. */
export function shortDate(value: string | Date): string {
  const d = typeof value === "string" ? new Date(value) : value;
  const day = String(d.getDate()).padStart(2, "0");
  const month = d.toLocaleDateString("en-GB", { month: "short" });
  const yy = String(d.getFullYear()).slice(-2);
  return `${day} ${month} '${yy}`;
}

/** Compact month label with year, e.g. "Jun '26" — used on month-bucketed charts. */
export function monthLabel(value: string | Date): string {
  const d = typeof value === "string" ? new Date(value) : value;
  const month = d.toLocaleDateString("en-GB", { month: "short" });
  const yy = String(d.getFullYear()).slice(-2);
  return `${month} '${yy}`;
}

/** Local date as an ISO yyyy-mm-dd string (avoids UTC off-by-one). */
function localISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export type ChartRange = "ytd" | "12m" | "24m" | "36m";

/** Number of trailing months a chart range covers ("ytd" = since Jan this year). */
export function monthsForRange(key: ChartRange): number {
  switch (key) {
    case "ytd":
      return new Date().getMonth() + 1;
    case "12m":
      return 12;
    case "24m":
      return 24;
    case "36m":
      return 36;
  }
}

/**
 * Human-readable labels for transaction direction. Selects must render these,
 * never the raw INCOME/EXPENSE key. See "The Select Label Rule" in DESIGN.md.
 */
export const DIRECTION_LABELS: Record<string, string> = {
  INCOME: "Income",
  EXPENSE: "Expense",
};

/** Human-readable labels for investment asset types shown in selects. */
export const TICKER_TYPE_LABELS: Record<string, string> = {
  ETF: "ETF",
  EQUITY: "Equity",
  CRYPTO: "Crypto",
};

/** Human-readable labels for investment movement sides shown in selects. */
export const INVESTMENT_SIDE_LABELS: Record<string, string> = {
  BUY: "Buy",
  SELL: "Sell",
};

export type DatePreset = "this-month" | "last-month" | "this-year" | "all";

/** From/to ISO bounds for a transactions-list quick preset (empty string = unset). */
export function dateRangePreset(key: DatePreset): { from: string; to: string } {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  switch (key) {
    case "this-month":
      return { from: localISO(new Date(y, m, 1)), to: localISO(new Date(y, m + 1, 0)) };
    case "last-month":
      return { from: localISO(new Date(y, m - 1, 1)), to: localISO(new Date(y, m, 0)) };
    case "this-year":
      return { from: localISO(new Date(y, 0, 1)), to: localISO(new Date(y, 11, 31)) };
    case "all":
      return { from: "", to: "" };
  }
}
