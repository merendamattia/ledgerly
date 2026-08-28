// Period presets for the cashflow page. Each preset resolves to a current
// window plus the immediately-comparable previous window, so every figure on
// the page (totals, deltas) is exact for the chosen range. All bounds are
// local yyyy-mm-dd strings to avoid UTC off-by-one drift.

import { formatMonthYear } from "@/lib/format";

export type PresetPeriod = "this-month" | "last-month" | "this-year" | "last-year" | "12m";
export type Period = PresetPeriod | `${number}-${string}`;

export interface ResolvedPeriod {
  from: string;
  to: string;
  prevFrom: string;
  prevTo: string;
  /** Label for the picker trigger + cards, e.g. "June 2026", "This year", "2025". */
  label: string;
  /** Label for the comparison card, e.g. "May 2026", "2025". */
  prevLabel: string;
  /** "month" gets month-specific copy; "range"/"year" share the generic copy. */
  kind: "month" | "range" | "year";
}

/** Formats a date as a local `yyyy-mm-dd` string. */
const iso = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

/** Resolves a cashflow period preset into current and previous comparison ranges. */
export function resolvePeriod(period: Period, now: Date = new Date()): ResolvedPeriod {
  const y = now.getFullYear();
  const m = now.getMonth();
  const selectedMonth = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(period);
  if (selectedMonth) {
    const from = new Date(Number(selectedMonth[1]), Number(selectedMonth[2]) - 1, 1);
    const prevFrom = new Date(from.getFullYear(), from.getMonth() - 1, 1);
    return {
      from: iso(from),
      to: iso(new Date(from.getFullYear(), from.getMonth() + 1, 0)),
      prevFrom: iso(prevFrom),
      prevTo: iso(new Date(from.getFullYear(), from.getMonth(), 0)),
      label: formatMonthYear(from),
      prevLabel: formatMonthYear(prevFrom),
      kind: "month",
    };
  }

  switch (period) {
    case "this-month": {
      const from = new Date(y, m, 1);
      const prevFrom = new Date(y, m - 1, 1);
      return {
        from: iso(from),
        to: iso(new Date(y, m + 1, 0)),
        prevFrom: iso(prevFrom),
        prevTo: iso(new Date(y, m, 0)),
        label: formatMonthYear(from),
        prevLabel: formatMonthYear(prevFrom),
        kind: "month",
      };
    }
    case "last-month": {
      const from = new Date(y, m - 1, 1);
      const prevFrom = new Date(y, m - 2, 1);
      return {
        from: iso(from),
        to: iso(new Date(y, m, 0)),
        prevFrom: iso(prevFrom),
        prevTo: iso(new Date(y, m - 1, 0)),
        label: formatMonthYear(from),
        prevLabel: formatMonthYear(prevFrom),
        kind: "month",
      };
    }
    case "this-year": {
      // Year to date vs the same span of the previous year.
      return {
        from: iso(new Date(y, 0, 1)),
        to: iso(now),
        prevFrom: iso(new Date(y - 1, 0, 1)),
        prevTo: iso(new Date(y - 1, m, now.getDate())),
        label: "This year",
        prevLabel: `${y - 1}`,
        kind: "range",
      };
    }
    case "last-year": {
      return {
        from: iso(new Date(y - 1, 0, 1)),
        to: iso(new Date(y - 1, 11, 31)),
        prevFrom: iso(new Date(y - 2, 0, 1)),
        prevTo: iso(new Date(y - 2, 11, 31)),
        label: `${y - 1}`,
        prevLabel: `${y - 2}`,
        kind: "year",
      };
    }
    case "12m": {
      return {
        from: iso(new Date(y, m - 11, 1)),
        to: iso(now),
        prevFrom: iso(new Date(y, m - 23, 1)),
        prevTo: iso(new Date(y, m - 12, 0)),
        label: "Last 12 months",
        prevLabel: "Previous 12 months",
        kind: "range",
      };
    }
  }

  return resolvePeriod("this-month", now);
}

/** Picker options in display order, with labels resolved against `now`. */
export function periodOptions(now: Date = new Date()): { value: Period; label: string }[] {
  const order: PresetPeriod[] = ["this-month", "last-month", "this-year", "last-year", "12m"];
  return order.map((value) => ({ value, label: resolvePeriod(value, now).label }));
}

/** Trailing `count` calendar months ending at (and including) `toISO`'s month. */
export function trailingRange(toISO: string, count = 6): { from: string; to: string } {
  const to = new Date(`${toISO}T00:00:00`);
  const from = new Date(to.getFullYear(), to.getMonth() - (count - 1), 1);
  return { from: iso(from), to: toISO };
}

/** Year-to-date window from Jan 1 of the current year through today. */
export function ytdRange(now: Date = new Date()): { from: string; to: string } {
  return { from: iso(new Date(now.getFullYear(), 0, 1)), to: iso(now) };
}
