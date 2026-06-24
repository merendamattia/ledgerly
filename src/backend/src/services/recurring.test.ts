import { expect, test } from "bun:test";
import { computeNextDate, occurrenceDates } from "./recurring.ts";

const iso = (d: Date) => d.toISOString().slice(0, 10);

test("computeNextDate advances by days/weeks/months", () => {
  const start = new Date("2026-01-15");
  expect(iso(computeNextDate(start, "DAY", 30))).toBe("2026-02-14");
  expect(iso(computeNextDate(start, "WEEK", 2))).toBe("2026-01-29");
  expect(iso(computeNextDate(start, "MONTH", 1))).toBe("2026-02-15");
});

test("computeNextDate clamps month overflow to last valid day", () => {
  expect(iso(computeNextDate(new Date("2026-01-31"), "MONTH", 1))).toBe("2026-02-28");
});

test("occurrenceDates honors AFTER_OCCURRENCES", () => {
  const dates = occurrenceDates(
    {
      startDate: new Date("2026-01-01"),
      intervalUnit: "DAY",
      intervalCount: 30,
      endMode: "AFTER_OCCURRENCES",
      maxOccurrences: 3,
      endDate: null,
    },
    50,
  );
  expect(dates.map(iso)).toEqual(["2026-01-01", "2026-01-31", "2026-03-02"]);
});

test("occurrenceDates honors ON_DATE", () => {
  const dates = occurrenceDates(
    {
      startDate: new Date("2026-01-01"),
      intervalUnit: "WEEK",
      intervalCount: 1,
      endMode: "ON_DATE",
      maxOccurrences: null,
      endDate: new Date("2026-01-20"),
    },
    50,
  );
  expect(dates.map(iso)).toEqual(["2026-01-01", "2026-01-08", "2026-01-15"]);
});

test("occurrenceDates with NEVER is bounded by limit", () => {
  const dates = occurrenceDates(
    {
      startDate: new Date("2026-01-01"),
      intervalUnit: "MONTH",
      intervalCount: 1,
      endMode: "NEVER",
      maxOccurrences: null,
      endDate: null,
    },
    5,
  );
  expect(dates).toHaveLength(5);
});
