import { expect, test } from "bun:test";
import { aggregateDashboardTransactions, dashboardMonthRange } from "./dashboard.ts";

/** Formats a test date as an ISO day string for dashboard range assertions. */
const iso = (d: Date) => d.toISOString().slice(0, 10);

const groceries = { id: "groceries", name: "Groceries" };
const salary = { id: "salary", name: "Salary" };
const investments = { id: "investments", name: "investments" };
const pac = { id: "pac", name: "PAC accumulo" };

test("dashboardMonthRange returns the current UTC month boundaries", () => {
  const range = dashboardMonthRange(new Date("2026-06-28T12:00:00Z"));

  expect(iso(range.start)).toBe("2026-06-01");
  expect(iso(range.todayInclusive)).toBe("2026-06-28");
  expect(iso(range.nextStart)).toBe("2026-07-01");
});

test("aggregateDashboardTransactions excludes payments dated after today", () => {
  const aggregates = aggregateDashboardTransactions(
    [
      {
        date: new Date("2026-06-28T00:00:00Z"),
        amount: 100,
        direction: "EXPENSE",
        category: groceries,
      },
      {
        date: new Date("2026-06-29T00:00:00Z"),
        amount: 500,
        direction: "EXPENSE",
        category: groceries,
      },
      {
        date: new Date("2026-07-01T00:00:00Z"),
        amount: 900,
        direction: "EXPENSE",
        category: groceries,
      },
    ],
    2,
    new Date("2026-06-28T12:00:00Z"),
  );

  expect(aggregates.categoryBreakdownMonth).toEqual([
    { categoryId: "groceries", name: "Groceries", income: 0, expense: 100 },
  ]);
  expect(aggregates.cashFlowSeries).toEqual([
    { month: "2026-05", income: 0, expense: 0, investment: 0 },
    { month: "2026-06", income: 0, expense: 100, investment: 0 },
  ]);
});

test("aggregateDashboardTransactions separates investment expenses from spending", () => {
  const aggregates = aggregateDashboardTransactions(
    [
      {
        date: new Date("2026-06-10T00:00:00Z"),
        amount: 2000,
        direction: "INCOME",
        category: salary,
      },
      {
        date: new Date("2026-06-11T00:00:00Z"),
        amount: 500,
        direction: "EXPENSE",
        category: groceries,
      },
      {
        date: new Date("2026-06-12T00:00:00Z"),
        amount: 300,
        direction: "EXPENSE",
        category: investments,
      },
      {
        date: new Date("2026-06-13T00:00:00Z"),
        amount: 200,
        direction: "EXPENSE",
        category: pac,
      },
    ],
    1,
    new Date("2026-06-28T12:00:00Z"),
  );

  expect(aggregates.categoryBreakdownMonth).toEqual([
    { categoryId: "salary", name: "Salary", income: 2000, expense: 0 },
    { categoryId: "groceries", name: "Groceries", income: 0, expense: 500 },
  ]);
  expect(aggregates.cashFlowSeries).toEqual([
    { month: "2026-06", income: 2000, expense: 500, investment: 500 },
  ]);
  expect(aggregates.cashFlowSeries[0].income - aggregates.cashFlowSeries[0].expense).toBe(1500);
});
