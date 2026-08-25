import { expect, test } from "bun:test";
import { currentPeriodDelta } from "./matrix-delta";

const months = [
  "2025-12-01",
  "2026-01-01",
  "2026-07-01",
  "2026-08-01",
  "2026-09-01",
  "2026-12-01",
];

test("compares today's value with the current month's boundary", () => {
  const values = [100, 13_332, 15_072, 14_761, 15_000, 16_000];

  expect(currentPeriodDelta(14_851, values, months, "month", new Date(2026, 7, 25))).toBeCloseTo(
    0.6097,
    3,
  );
});

test("compares today's value with January 1 of the current year", () => {
  const values = [100, 13_332, 15_072, 14_761, 15_000, 16_000];

  expect(currentPeriodDelta(14_851, values, months, "year", new Date(2026, 7, 25))).toBeCloseTo(
    11.3936,
    3,
  );
  expect(currentPeriodDelta(20_000, values, months, "year", new Date(2026, 11, 31))).toBeCloseTo(
    50.015,
    3,
  );
});

test("returns null when the required boundary is missing or zero", () => {
  expect(currentPeriodDelta(120, [0], ["2026-08-01"], "month", new Date(2026, 7, 25))).toBeNull();
  expect(currentPeriodDelta(120, [null], ["2026-01-01"], "year", new Date(2026, 7, 25))).toBeNull();
  expect(currentPeriodDelta(120, [100], ["2026-08-01"], "year", new Date(2026, 7, 25))).toBeNull();
  expect(currentPeriodDelta(null, [100], ["2026-08-01"], "month", new Date(2026, 7, 25))).toBeNull();
});
