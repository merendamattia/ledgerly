import { expect, test } from "bun:test";
import {
  aggregateForecastCashflows,
  investmentLedgerContribution,
} from "./financialForecastInputs.ts";

const cutoff = new Date("2026-02-28T00:00:00.000Z");

test("investment buys, fees and sell proceeds are converted into signed base-currency flows", () => {
  expect(
    investmentLedgerContribution(
      {
        date: new Date("2026-01-10T00:00:00.000Z"),
        side: "BUY",
        quantity: 10,
        price: 20,
        fee: 5,
      },
      2,
    ),
  ).toEqual({
    date: new Date("2026-01-10T00:00:00.000Z"),
    buyAmount: 410,
    netAmount: 410,
  });
  expect(
    investmentLedgerContribution(
      {
        date: new Date("2026-02-10T00:00:00.000Z"),
        side: "SELL",
        quantity: 2,
        price: 30,
        fee: 1,
      },
      2,
    ),
  ).toEqual({
    date: new Date("2026-02-10T00:00:00.000Z"),
    buyAmount: 0,
    netAmount: -118,
  });
});

test("investment-ledger activity alone produces base-currency contribution observations", () => {
  const result = aggregateForecastCashflows(
    [],
    [
      {
        date: new Date("2026-01-10T00:00:00.000Z"),
        buyAmount: 205,
        netAmount: 205,
      },
      {
        date: new Date("2026-02-10T00:00:00.000Z"),
        buyAmount: 0,
        netAmount: -59,
      },
    ],
    cutoff,
  );

  expect(result.observations.map(({ month, investmentContributions }) => ({
    month,
    investmentContributions,
  }))).toEqual([
    { month: "2026-01-01", investmentContributions: 205 },
    { month: "2026-02-01", investmentContributions: -59 },
  ]);
  expect(result.contributions).toEqual([
    { date: "2026-01-01", value: 205 },
    { date: "2026-02-01", value: -59 },
  ]);
});

test("categorized investment expenses already represented by ledger buys are not counted twice", () => {
  const result = aggregateForecastCashflows(
    [
      {
        date: new Date("2026-01-10T00:00:00.000Z"),
        direction: "EXPENSE",
        amount: 205,
        recurringExpenseId: null,
        category: { name: "Investments" },
      },
    ],
    [
      {
        date: new Date("2026-01-10T00:00:00.000Z"),
        buyAmount: 205,
        netAmount: 205,
      },
    ],
    cutoff,
  );

  expect(result.observations[0].investmentContributions).toBe(205);
  expect(result.contributions[0].value).toBe(205);
});
