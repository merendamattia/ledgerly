import { afterAll, beforeAll, expect, test } from "bun:test";
import { prisma } from "../src/core/db.ts";
import { buildFinancialForecast } from "../src/services/financialForecast.ts";
import { buildInvestmentReturnModel } from "../src/services/financialForecastInputs.ts";
import { computeInvestmentHistory } from "../src/services/investmentHistory.ts";

const suffix = `${Date.now()}-${process.pid}`;
const userId = `forecast-current-portfolio-${suffix}`;
const currentSymbol = `CURRENT.${suffix}`;
const soldSymbol = `SOLD.${suffix}`;
let currentTickerId = "";
let soldTickerId = "";
const today = new Date();
today.setUTCHours(0, 0, 0, 0);
const historyMonth = (offset: number) =>
  new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + offset, 1));

beforeAll(async () => {
  await prisma.user.create({
    data: { id: userId, name: "Current Portfolio Forecast", email: `${userId}@example.com` },
  });
  const [currentTicker, soldTicker] = await Promise.all([
    prisma.ticker.create({
      data: {
        userId,
        symbol: currentSymbol,
        name: "Current holding",
        type: "ETF",
        currency: "EUR",
        provider: "yahoo",
      },
    }),
    prisma.ticker.create({
      data: {
        userId,
        symbol: soldSymbol,
        name: "Sold holding",
        type: "ETF",
        currency: "EUR",
        provider: "yahoo",
      },
    }),
  ]);
  currentTickerId = currentTicker.id;
  soldTickerId = soldTicker.id;

  await Promise.all([
    prisma.providerPriceHistory.createMany({
      data: [100, 100, 100, 100, 100].map((close, index) => ({
        provider: "yahoo",
        symbol: currentSymbol,
        date: historyMonth(index - 4),
        close,
      })),
    }),
    prisma.providerPriceHistory.createMany({
      data: [100, 200, 400, 400, 400].map((close, index) => ({
        provider: "yahoo",
        symbol: soldSymbol,
        date: historyMonth(index - 4),
        close,
      })),
    }),
    prisma.investmentTransaction.createMany({
      data: [
        {
          userId,
          tickerId: currentTickerId,
          date: historyMonth(-4),
          side: "BUY",
          quantity: 1,
          price: 100,
        },
        {
          userId,
          tickerId: soldTickerId,
          date: historyMonth(-4),
          side: "BUY",
          quantity: 1,
          price: 100,
        },
        {
          userId,
          tickerId: soldTickerId,
          date: historyMonth(-1),
          side: "SELL",
          quantity: 1,
          price: 400,
        },
      ],
    }),
  ]);
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { id: userId } });
  await prisma.providerPriceHistory.deleteMany({
    where: { provider: "yahoo", symbol: { in: [currentSymbol, soldSymbol] } },
  });
});

test("a sold ticker cannot affect the current portfolio forecast", async () => {
  const allHistory = await computeInvestmentHistory(userId, async () => 1, {
    priceBackedOnly: true,
  });
  const allReturns = buildInvestmentReturnModel(allHistory).returns;
  expect(allReturns.some((value) => value > 0.1)).toBe(true);

  const currentHistory = await computeInvestmentHistory(userId, async () => 1, {
    priceBackedOnly: true,
    tickerIds: [currentTickerId],
  });
  const currentReturnModel = buildInvestmentReturnModel(currentHistory);
  expect(currentReturnModel.returns.length).toBeGreaterThanOrEqual(2);
  expect(currentReturnModel.returns.every((value) => value === 0)).toBe(true);

  const forecast = buildFinancialForecast(
    {
      cutoff: today,
      baseCurrency: "EUR",
      current: {
        cash: 0,
        credits: 0,
        otherAssets: 0,
        investments: 100,
        marketInvestments: 100,
        fallbackInvestments: 0,
        debts: 0,
        total: 100,
      },
      monthlyObservations: [],
      recurringFuture: [],
      investmentReturns: currentReturnModel.returns,
      historical: {
        netWorth: [],
        income: [],
        expenses: [],
        investments: [],
        contributions: [],
      },
      investmentReturn: currentReturnModel.summary,
    },
    { horizonMonths: 1, simulationCount: 2, random: () => 0 },
  );

  expect(forecast.series.investments[0].p50).toBe(100);
});
