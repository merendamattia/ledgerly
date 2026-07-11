import { expect, test } from "bun:test";
import {
  axisBounds,
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

test("axisBounds floors below the min and leaves a step of headroom above the peak", () => {
  // The reported case: 60k–76k window should top out at 85k, not 100k.
  const b = axisBounds([60_155, 68_000, 76_155]);
  expect(b.min).toBe(60_000);
  expect(b.max).toBe(85_000);
  expect(b.ticks[0]).toBe(60_000);
  expect(b.ticks.at(-1)).toBe(85_000);
  // Peak sits strictly below the top so the line never hugs the edge.
  expect(b.max).toBeGreaterThan(76_155);

  expect(axisBounds([]).max).toBe(0);
  expect(axisBounds([0, 40_000, 80_000]).min).toBe(0);
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
