import { expect, test } from "bun:test";
import {
  CUSTOM_TRANSACTION_PERIOD,
  loadCompletePages,
  resolveTransactionRange,
  shouldLoadCompleteTransactionResults,
  summarizeTransactionCategories,
  summarizeTransactionRows,
} from "./transaction-period";

const TODAY = "2026-08-25";

test("resolves month presets through the existing inclusive date filters", () => {
  expect(resolveTransactionRange("2026-07", TODAY)).toEqual({
    from: "2026-07-01",
    to: "2026-07-31",
  });
  expect(resolveTransactionRange("2026-08", TODAY)).toEqual({
    from: "2026-08-01",
    to: TODAY,
  });
  expect(resolveTransactionRange("all", TODAY)).toEqual({
    from: undefined,
    to: TODAY,
  });
});

test("resolves and bounds a custom date range", () => {
  expect(
    resolveTransactionRange(CUSTOM_TRANSACTION_PERIOD, TODAY, "2026-07-15", "2026-08-10"),
  ).toEqual({
    from: "2026-07-15",
    to: "2026-08-10",
  });
  expect(
    resolveTransactionRange(CUSTOM_TRANSACTION_PERIOD, TODAY, "2026-08-20", "2026-09-01"),
  ).toEqual({
    from: "2026-08-20",
    to: TODAY,
  });
});

test("clearing custom dates falls back to the current period boundary", () => {
  expect(resolveTransactionRange(CUSTOM_TRANSACTION_PERIOD, TODAY, "", "")).toEqual({
    from: undefined,
    to: TODAY,
  });
});

test("keeps All time paginated and loads every bounded-period page", async () => {
  expect(shouldLoadCompleteTransactionResults("all")).toBe(false);
  expect(shouldLoadCompleteTransactionResults("2026-08")).toBe(true);
  expect(shouldLoadCompleteTransactionResults(CUSTOM_TRANSACTION_PERIOD)).toBe(true);

  const rows = Array.from({ length: 5_001 }, (_, index) => index);
  const requests: Array<[number, number]> = [];
  const loaded = await loadCompletePages((offset, limit) => {
    requests.push([offset, limit]);
    return Promise.resolve(rows.slice(offset, offset + limit));
  });

  expect(loaded).toEqual(rows);
  expect(requests).toEqual([
    [0, 5_000],
    [5_000, 5_000],
  ]);
});

test("calculates income, expenses, and net for the effective filtered rows", () => {
  expect(
    summarizeTransactionRows([
      { direction: "INCOME", amount: 1_250 },
      { direction: "EXPENSE", amount: 300 },
      { direction: "EXPENSE", amount: 75.5 },
    ]),
  ).toEqual({ income: 1_250, expenses: 375.5, net: 874.5 });
});

test("groups filtered income and expenses by category", () => {
  expect(
    summarizeTransactionCategories([
      { direction: "EXPENSE", amount: 40, category: { id: "food", name: "Food" } },
      { direction: "EXPENSE", amount: 15, category: { id: "food", name: "Food" } },
      { direction: "INCOME", amount: 1_000, category: { id: "salary", name: "Salary" } },
      { direction: "INCOME", amount: 25, category: null },
    ]),
  ).toEqual({
    income: { salary: 1_000, uncategorized: 25 },
    expenses: { food: 55 },
    labels: { food: "Food", salary: "Salary", uncategorized: "Uncategorized" },
  });
});
