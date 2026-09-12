import { expect, test } from "bun:test";
import {
  aggregateForecastCashflows,
  buildInvestmentReturnModel,
  investmentContributionFlows,
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

test("missing portfolio prices use the zero-return fallback instead of treating contributions as losses", () => {
  const model = buildInvestmentReturnModel([
    { date: "2026-01-31", value: 0, invested: 100 },
    { date: "2026-02-28", value: 0, invested: 200 },
  ]);

  expect(model).toEqual({
    returns: [],
    summary: {
      observationMonths: 0,
      cagr: null,
      annualizedArithmeticReturn: null,
      annualizedVolatility: null,
      fallback: "NO_RELIABLE_MARKET_HISTORY",
    },
  });
});

test("investment contribution conversion uses the supplied persisted FX resolver", async () => {
  const requests: string[] = [];
  const flows = await investmentContributionFlows(
    [
      {
        date: new Date("2026-01-10T00:00:00.000Z"),
        side: "BUY",
        quantity: 10,
        price: 20,
        fee: 5,
        ticker: { currency: "USD" },
      },
    ],
    "EUR",
    async (base, quote, date) => {
      requests.push(`${base}:${quote}:${date.toISOString().slice(0, 10)}`);
      return 0.9;
    },
  );

  expect(requests).toEqual(["USD:EUR:2026-01-10"]);
  expect(flows).toEqual([
    {
      date: new Date("2026-01-10T00:00:00.000Z"),
      buyAmount: 184.5,
      netAmount: 184.5,
    },
  ]);
});
