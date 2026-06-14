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

/** Today's date as an ISO yyyy-mm-dd string (for date inputs). */
export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
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
