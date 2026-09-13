import { expect, test } from "bun:test";
import { buildFinancialForecast } from "./financialForecast.ts";
import {
  aggregateForecastCashflows,
  buildInvestmentReturnModel,
  investmentContributionFlows,
  investmentLedgerContribution,
  partitionInvestmentHoldings,
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
    principalAmount: 400,
    feeAmount: 10,
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
    principalAmount: -120,
    feeAmount: 2,
  });
});

test("investment-ledger activity alone produces base-currency contribution observations", () => {
  const result = aggregateForecastCashflows(
    [],
    [
      {
        date: new Date("2026-01-10T00:00:00.000Z"),
        buyAmount: 205,
        principalAmount: 200,
        feeAmount: 5,
      },
      {
        date: new Date("2026-02-10T00:00:00.000Z"),
        buyAmount: 0,
        principalAmount: -60,
        feeAmount: 1,
      },
    ],
    cutoff,
  );

  expect(result.observations.map(({ month, investmentContributions, investmentFees }) => ({
    month,
    investmentContributions,
    investmentFees,
  }))).toEqual([
    { month: "2026-01-01", investmentContributions: 200, investmentFees: 5 },
    { month: "2026-02-01", investmentContributions: -60, investmentFees: 1 },
  ]);
  expect(result.contributions).toEqual([
    { date: "2026-01-01", value: 200 },
    { date: "2026-02-01", value: -60 },
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
        principalAmount: 200,
        feeAmount: 5,
      },
    ],
    cutoff,
  );

  expect(result.observations[0].investmentContributions).toBe(200);
  expect(result.observations[0].investmentFees).toBe(5);
  expect(result.contributions[0].value).toBe(200);
});

test("old activity followed by twelve empty months has reduced forecast confidence", () => {
  const result = aggregateForecastCashflows(
    [
      {
        date: new Date("2025-01-10T00:00:00.000Z"),
        direction: "INCOME",
        amount: 100,
        recurringExpenseId: null,
      },
    ],
    [],
    cutoff,
  );

  expect(result.observations).toHaveLength(12);
  expect(result.observations.every(({ income, expenses }) => income === 0 && expenses === 0)).toBe(
    true,
  );

  const forecast = buildFinancialForecast(
    {
      cutoff,
      baseCurrency: "EUR",
      current: {
        cash: 0,
        credits: 0,
        otherAssets: 0,
        investments: 0,
        marketInvestments: 0,
        fallbackInvestments: 0,
        debts: 0,
        total: 0,
      },
      monthlyObservations: result.observations,
      recurringFuture: [],
      investmentReturns: [],
      historical: {
        netWorth: [],
        income: result.income,
        expenses: result.expenses,
        investments: [],
        contributions: result.contributions,
      },
      investmentReturn: {
        observationMonths: 0,
        cagr: null,
        annualizedArithmeticReturn: null,
        annualizedVolatility: null,
        fallback: "NO_RELIABLE_MARKET_HISTORY",
      },
    },
    { horizonMonths: 1, simulationCount: 2, random: () => 0 },
  );

  expect(forecast.assumptions).toMatchObject({
    effectiveLookbackMonths: 12,
    observationMonths: 0,
    dataQuality: "REDUCED",
  });
});

test("missing portfolio prices use the zero-return fallback instead of treating contributions as losses", () => {
  const model = buildInvestmentReturnModel([
    { date: "2026-01-31", value: 0, netContributions: 100 },
    { date: "2026-02-28", value: 0, netContributions: 200 },
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

test("zero opening capital cannot manufacture a market return from contributions", () => {
  const model = buildInvestmentReturnModel([
    { date: "2026-01-31", value: 0, netContributions: 0 },
    { date: "2026-02-28", value: 0, netContributions: 100 },
    { date: "2026-03-31", value: 100, netContributions: 100 },
    { date: "2026-04-30", value: 99, netContributions: 100 },
  ]);

  expect(model).toEqual({
    returns: [],
    summary: {
      observationMonths: 1,
      cagr: null,
      annualizedArithmeticReturn: null,
      annualizedVolatility: null,
      fallback: "NO_RELIABLE_MARKET_HISTORY",
    },
  });
});

test("one observed market return falls back to zero instead of repeating it for 20 years", () => {
  const model = buildInvestmentReturnModel([
    { date: "2026-01-31", value: 100, netContributions: 100 },
    { date: "2026-02-28", value: 110, netContributions: 100 },
  ]);

  expect(model).toEqual({
    returns: [],
    summary: {
      observationMonths: 1,
      cagr: null,
      annualizedArithmeticReturn: null,
      annualizedVolatility: null,
      fallback: "NO_RELIABLE_MARKET_HISTORY",
    },
  });

  const forecast = buildFinancialForecast(
    {
      cutoff,
      baseCurrency: "EUR",
      current: {
        cash: 0,
        credits: 0,
        otherAssets: 0,
        investments: 110,
        marketInvestments: 110,
        fallbackInvestments: 0,
        debts: 0,
        total: 110,
      },
      monthlyObservations: [],
      recurringFuture: [],
      investmentReturns: model.returns,
      historical: {
        netWorth: [{ date: "2026-02-28", value: 110 }],
        income: [],
        expenses: [],
        investments: [{ date: "2026-02-28", value: 110 }],
        contributions: [],
      },
      investmentReturn: model.summary,
    },
    { horizonMonths: 240, simulationCount: 2, random: () => 0 },
  );

  expect(forecast.series.investments.every((point) => point.p50 === 110)).toBe(true);
  expect(forecast.series.netWorth.every((point) => point.p50 === 110)).toBe(true);
});

test("current holdings partition manual and unpriced values into a flat fallback sleeve", () => {
  expect(
    partitionInvestmentHoldings([
      { provider: "yahoo", priceDate: "2026-02-27", value: 100 },
      { provider: "manual", priceDate: "2026-02-28", value: 60 },
      { provider: "yahoo", priceDate: null, value: 40 },
    ]),
  ).toEqual({
    marketInvestments: 100,
    fallbackInvestments: 100,
  });
});

test("profitable liquidation and fees stay outside portfolio market returns", () => {
  const sale = investmentLedgerContribution(
    {
      date: new Date("2026-02-10T00:00:00.000Z"),
      side: "SELL",
      quantity: 1,
      price: 150,
      fee: 5,
    },
    1,
  );
  const model = buildInvestmentReturnModel([
    { date: "2026-01-31", value: 200, netContributions: 100 },
    {
      date: "2026-02-28",
      value: 50,
      netContributions: 100 + sale.principalAmount,
    },
    {
      date: "2026-03-31",
      value: 50,
      netContributions: 100 + sale.principalAmount,
    },
  ]);

  expect(sale).toMatchObject({ principalAmount: -150, feeAmount: 5 });
  expect(model.returns).toEqual([0, 0]);
  expect(model.summary.annualizedArithmeticReturn).toBe(0);
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
      principalAmount: 180,
      feeAmount: 4.5,
    },
  ]);
});
