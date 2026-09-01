// Formatting helpers shared across the UI.

import type { Locale } from "@/i18n/config";

/**
 * Decimal places for a money/number figure: 0 from 1000 up, 2 below. Large
 * numbers with two decimals read poorly on mobile, so we trim at the thousand.
 */
const fractionDigits = (value: number): number => (Math.abs(value) >= 1000 ? 0 : 2);

const moneyFormatters = new Map<string, Intl.NumberFormat>();
const numberFormatters = new Map<string, Intl.NumberFormat>();
const compactMoneyFormatters = new Map<string, Intl.NumberFormat>();
const dateFormatters = new Map<string, Intl.DateTimeFormat>();

const intlLocales: Record<Locale, { number: string; date: string }> = {
  en: { number: "en-US", date: "en-GB" },
  it: { number: "it-IT", date: "it-IT" },
};

let activeLocale: Locale = "en";

/** Updates the locale used by presentation-only formatting helpers. */
export function setFormatLocale(locale: Locale): void {
  activeLocale = locale;
}

function cachedFormatter(
  cache: Map<string, Intl.NumberFormat>,
  key: string,
  options: Intl.NumberFormatOptions,
): Intl.NumberFormat {
  const locale = intlLocales[activeLocale].number;
  const localeKey = `${activeLocale}:${key}`;
  let formatter = cache.get(localeKey);
  if (!formatter) {
    formatter = new Intl.NumberFormat(locale, options);
    cache.set(localeKey, formatter);
  }
  return formatter;
}

function cachedDateFormatter(key: string, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const localeKey = `${activeLocale}:${key}`;
  let formatter = dateFormatters.get(localeKey);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(intlLocales[activeLocale].date, options);
    dateFormatters.set(localeKey, formatter);
  }
  return formatter;
}

/** Format a currency value using Ledgerly's compact decimal rules. */
export function formatMoney(value: number, currency = "EUR"): string {
  const digits = fractionDigits(value);
  return cachedFormatter(moneyFormatters, `${currency}:${digits}`, {
    style: "currency",
    currency,
    maximumFractionDigits: digits,
  }).format(value);
}

/** Format a plain number, trimming decimals for large magnitudes by default. */
export function formatNumber(value: number, maximumFractionDigits?: number): string {
  const digits = maximumFractionDigits ?? fractionDigits(value);
  const key = `${activeLocale}:${digits}`;
  let formatter = numberFormatters.get(key);
  if (!formatter) {
    formatter = new Intl.NumberFormat(intlLocales[activeLocale].number, { maximumFractionDigits: digits });
    numberFormatters.set(key, formatter);
  }
  return formatter.format(value);
}

/** Compact currency for tight spaces like chart axes, e.g. "€45k", "€2.0k". */
export function compactMoney(value: number, currency = "EUR"): string {
  return cachedFormatter(compactMoneyFormatters, currency, {
    style: "currency",
    currency,
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

/** A "nice" step (1/2/5 × 10ⁿ) roughly sized to a value span, for axis rounding. */
function niceStep(span: number): number {
  const mag = 10 ** Math.floor(Math.log10(span));
  const norm = span / mag;
  const nice = norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10;
  return nice * mag;
}

/**
 * Lower bound for a chart Y-axis so zoomed-in series aren't squashed against a
 * fixed 0 baseline. Floors the data minimum to a nice step below it (e.g. a
 * 66k–75k range starts at 60k). Returns 0 when the series reaches at/below zero,
 * so full-range views still start at 0.
 */
/**
 * Nice y-axis bounds + gridline ticks for one or more value series (pass every
 * line's points flattened into `values`). Both ends get one step of breathing
 * room: pad away from the data by a step, then floor the min / ceil the max to
 * that step. This keeps the line off both edges and stops the chart lib from
 * over-nicing the range (e.g. showing €40K–€100K for a €60K–€76K window).
 */
export function axisBounds(values: number[]): { min: number; max: number; ticks: number[] } {
  if (values.length === 0) return { min: 0, max: 0, ticks: [0] };
  const dataMin = Math.min(...values);
  const dataMax = Math.max(...values);
  // A quarter of the span keeps the step fine (~5k on a 76k/60k window) so the
  // bounds land on a tight gridline rather than the next 20k one.
  const step = niceStep((dataMax - dataMin || dataMax * 0.05) / 4);
  const min = Math.max(0, Math.floor((dataMin - step) / step) * step);
  const max = Math.ceil((dataMax + step) / step) * step;
  const ticks: number[] = [];
  for (let t = min; t <= max + 1e-6; t += step) ticks.push(t);
  return { min, max, ticks };
}

/** Hard-truncate a string to `max` characters, appending an ellipsis if cut. */
export function truncate(value: string, max = 25): string {
  return value.length > max ? `${value.slice(0, max).trimEnd()}…` : value;
}

/** Signed percentage label for performance deltas, e.g. "+1.24%". */
export function formatPercent(value: number): string {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

/** Human-readable calendar date, e.g. "14 Jun 2026". */
export function formatDate(value: string | Date): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return cachedDateFormatter("date", { day: "2-digit", month: "short", year: "numeric" }).format(date);
}

/** Human-readable date and time for logs and cron run metadata. */
export function formatDateTime(value: string | Date): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return cachedDateFormatter("date-time", {
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
  return cachedDateFormatter("numeric", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(d);
}

/** Long, uppercase day label, e.g. "FRIDAY 19 JUNE 2026" — used as list day headers. */
export function longDate(value: string | Date): string {
  const d = typeof value === "string" ? new Date(value) : value;
  return cachedDateFormatter("long", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(d).toLocaleUpperCase(intlLocales[activeLocale].date);
}

/**
 * Bucket items into ordered day groups, preserving input order (callers pass
 * newest-first lists). Each group carries a `key` (local yyyy-mm-dd, avoids the
 * UTC off-by-one) and a `label` from {@link longDate}.
 */
export function groupByDay<T>(
  items: T[],
  getDate: (item: T) => string | Date,
): { key: string; label: string; items: T[] }[] {
  const groups: { key: string; label: string; items: T[] }[] = [];
  const byKey = new Map<string, { key: string; label: string; items: T[] }>();
  for (const item of items) {
    const raw = getDate(item);
    const d = typeof raw === "string" ? new Date(raw) : raw;
    const key = localISO(d);
    let group = byKey.get(key);
    if (!group) {
      group = { key, label: longDate(d), items: [] };
      byKey.set(key, group);
      groups.push(group);
    }
    group.items.push(item);
  }
  return groups;
}

/** Compact day label with year, e.g. "15 Jun '26" — used on chart axes/rows. */
export function shortDate(value: string | Date): string {
  const d = typeof value === "string" ? new Date(value) : value;
  const day = String(d.getDate()).padStart(2, "0");
  const month = cachedDateFormatter("short-month", { month: "short" }).format(d);
  const yy = String(d.getFullYear()).slice(-2);
  return `${day} ${month} '${yy}`;
}

/** Compact month label with year, e.g. "Jun '26" — used on month-bucketed charts. */
export function monthLabel(value: string | Date): string {
  const d = typeof value === "string" ? new Date(value) : value;
  const month = cachedDateFormatter("short-month", { month: "short" }).format(d);
  const yy = String(d.getFullYear()).slice(-2);
  return `${month} '${yy}`;
}

/** Long month label, e.g. "June 2026" — used by period pickers. */
export function formatMonthYear(value: string | Date): string {
  const d = typeof value === "string" ? new Date(value) : value;
  return cachedDateFormatter("month-year", { month: "long", year: "numeric" }).format(d);
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
  BOND: "Bond",
  COMMODITY: "Commodity",
};

/** Human-readable labels for investment movement sides shown in selects. */
export const INVESTMENT_SIDE_LABELS: Record<string, string> = {
  BUY: "Buy",
  SELL: "Sell",
};

/** Human-readable labels for the cash-account sections shown in selects. */
export const CASH_CATEGORY_LABELS: Record<string, string> = {
  LIQUIDITY: "Liquidity",
  CREDIT: "Credits",
  OTHER_ASSET: "Other assets",
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
