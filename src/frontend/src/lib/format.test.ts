import { expect, test } from "bun:test";
import {
  axisFloor,
  compactMoney,
  formatDate,
  formatMoney,
  formatMonthYear,
  formatNumber,
} from "./format";

test("formatMoney trims cents for large amounts and keeps small cents", () => {
  expect(formatMoney(1234.56, "EUR")).toBe("€1,235");
  expect(formatMoney(12.34, "EUR")).toBe("€12.34");
  expect(formatMoney(1000, "EUR")).toBe("€1,000"); // exactly 1000 → no cents
  expect(formatMoney(999.5, "EUR")).toBe("€999.50"); // below 1000 → cents kept
});

test("axisFloor floors to a nice step below the data min, 0 when reaching zero", () => {
  expect(axisFloor([66_000, 70_000, 75_000])).toBe(60_000);
  expect(axisFloor([0, 40_000, 80_000])).toBe(0);
  expect(axisFloor([-5, 10, 20])).toBe(0);
  expect(axisFloor([])).toBe(0);
});

test("formatNumber respects explicit precision", () => {
  expect(formatNumber(1234.56)).toBe("1,235");
  expect(formatNumber(1234.56, 2)).toBe("1,234.56");
  expect(formatNumber(1234.56, 4)).toBe("1,234.56");
});

test("date labels stay stable for dense UI rows and pickers", () => {
  expect(formatDate("2026-06-14")).toBe("14 Jun 2026");
  expect(formatMonthYear("2026-06-01")).toBe("June 2026");
});

test("compactMoney uses compact currency labels for chart axes", () => {
  expect(compactMoney(45_000, "EUR")).toBe("€45K");
});
