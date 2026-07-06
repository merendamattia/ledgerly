import { expect, test } from "bun:test";
import { compactMoney, formatDate, formatMoney, formatMonthYear, formatNumber } from "./format";

test("formatMoney trims cents for large amounts and keeps small cents", () => {
  expect(formatMoney(1234.56, "EUR")).toBe("€1,235");
  expect(formatMoney(12.34, "EUR")).toBe("€12.34");
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
