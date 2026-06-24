// Client mirror of the backend occurrence logic (src/backend/src/services/
// recurring.ts). Used for the form preview and the Cash Flow upcoming list so
// the UI shows the same booking dates the cron will produce — without a round
// trip. Works on local dates (yyyy-mm-dd) to match how dates render in the app.

export type RecurInterval = "DAY" | "WEEK" | "MONTH";
export type RecurEndMode = "NEVER" | "AFTER_OCCURRENCES" | "ON_DATE";

export interface OccurrenceRule {
  startDate: string; // ISO date (yyyy-mm-dd or full ISO)
  intervalUnit: RecurInterval;
  intervalCount: number;
  endMode: RecurEndMode;
  maxOccurrences?: number | null;
  endDate?: string | null;
}

const MAX_ITERATIONS = 400;

function dayOnly(value: string | Date): Date {
  const d = typeof value === "string" ? new Date(value) : value;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** Advance a date by `count` units; MONTH clamps day-of-month overflow. */
export function computeNextDate(date: Date, unit: RecurInterval, count: number): Date {
  const d = dayOnly(date);
  if (unit === "DAY") return new Date(d.getFullYear(), d.getMonth(), d.getDate() + count);
  if (unit === "WEEK") return new Date(d.getFullYear(), d.getMonth(), d.getDate() + count * 7);
  const day = d.getDate();
  const lastDay = new Date(d.getFullYear(), d.getMonth() + count + 1, 0).getDate();
  return new Date(d.getFullYear(), d.getMonth() + count, Math.min(day, lastDay));
}

/** Booking dates a rule produces from its start, honoring the end condition. */
export function occurrenceDates(rule: OccurrenceRule, limit: number): Date[] {
  if (!rule.startDate || !rule.intervalCount || rule.intervalCount < 1) return [];
  const dates: Date[] = [];
  let current = dayOnly(rule.startDate);
  const end = rule.endDate ? dayOnly(rule.endDate) : null;

  for (let i = 0; i < limit && i < MAX_ITERATIONS; i++) {
    if (
      rule.endMode === "AFTER_OCCURRENCES" &&
      rule.maxOccurrences != null &&
      i >= rule.maxOccurrences
    )
      break;
    if (rule.endMode === "ON_DATE" && end && current.getTime() > end.getTime()) break;
    dates.push(current);
    current = computeNextDate(current, rule.intervalUnit, rule.intervalCount);
  }
  return dates;
}

/** Occurrences strictly after `from` up to and including `to` (inclusive). */
export function occurrencesBetween(rule: OccurrenceRule, from: Date, to: Date): Date[] {
  const f = dayOnly(from).getTime();
  const t = dayOnly(to).getTime();
  // Generous cap so long-running daily rules still reach the window.
  return occurrenceDates(rule, MAX_ITERATIONS).filter((d) => {
    const ms = d.getTime();
    return ms >= f && ms <= t;
  });
}

const UNIT_SINGULAR: Record<RecurInterval, string> = { DAY: "day", WEEK: "week", MONTH: "month" };

/** Human cadence label, e.g. "Every 30 days", "Every week", "Every 2 months". */
export function cadenceLabel(unit: RecurInterval, count: number): string {
  const noun = UNIT_SINGULAR[unit];
  return count === 1 ? `Every ${noun}` : `Every ${count} ${noun}s`;
}
