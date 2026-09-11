import { randomUUID } from "node:crypto";
import { computeCashflowMatrix, type CashflowMatrix } from "./cashflowMatrix.ts";
import { getFinancialForecast, type PercentilePoint } from "./financialForecast.ts";
import { computeInvestmentHistory, type PortfolioPoint } from "./investmentHistory.ts";
import { getStoredFxRate } from "./market/fx.ts";
import { computeNetWorthHistory, type NetWorthPoint } from "./netWorthHistory.ts";
import type { ForecastPoint, ForecastSnapshot, HistoricalPoint } from "./forecastContract.ts";

function monthEnd<T extends { date: string }>(points: T[]): T[] {
  const latest = new Map<string, T>();
  for (const point of points) latest.set(point.date.slice(0, 7), point);
  return [...latest.values()].sort((a, b) => a.date.localeCompare(b.date));
}

function flowHistory(matrix: CashflowMatrix, rows: CashflowMatrix["income"]): HistoricalPoint[] {
  return matrix.months.map((date, index) => ({
    date,
    value: rows.reduce((sum, row) => sum + (row.values[index] ?? 0), 0),
  }));
}

function investmentHistory(points: PortfolioPoint[]): HistoricalPoint[] {
  let previousInvested = 0;
  return monthEnd(points).map((point) => {
    const contribution = point.invested - previousInvested;
    previousInvested = point.invested;
    return { date: point.date, value: point.value, contribution };
  });
}

function netWorthHistory(points: NetWorthPoint[]): HistoricalPoint[] {
  return monthEnd(points).map((point) => ({ date: point.date, value: point.totalValue }));
}

function forecastPoints(points: PercentilePoint[]): ForecastPoint[] {
  return points.map((point) => ({ ...point, date: `${point.month}-01` }));
}

/** Builds the complete compact API snapshot in the worker, never in a read request. */
export async function buildForecastSnapshot(userId: string): Promise<ForecastSnapshot> {
  const sourceDataCutoff = new Date();
  const [forecast, netWorth, cashflow, investments] = await Promise.all([
    getFinancialForecast(userId, { now: sourceDataCutoff, horizonMonths: 240 }),
    computeNetWorthHistory(userId, {
      resolveFxRate: getStoredFxRate,
      providerBackedInvestmentsOnly: true,
    }),
    computeCashflowMatrix(userId),
    computeInvestmentHistory(userId, { resolveFxRate: getStoredFxRate }),
  ]);
  const generatedAt = new Date();

  return {
    id: randomUUID(),
    generatedAt: generatedAt.toISOString(),
    sourceDataCutoff: sourceDataCutoff.toISOString(),
    currency: forecast.assumptions.currency,
    effectiveLookbackMonths: forecast.assumptions.effectiveLookbackMonths,
    observationCount: forecast.assumptions.observationCount,
    simulationCount: forecast.assumptions.simulationCount,
    dataQuality:
      forecast.assumptions.dataQuality === "standard"
        ? "HIGH"
        : forecast.assumptions.dataQuality === "reduced"
          ? "MEDIUM"
          : "LOW",
    assumptions: [
      ...forecast.assumptions.components,
      `return-fallback:${forecast.assumptions.returnFallback}`,
      "historical-patterns-bootstrap",
    ],
    history: {
      netWorth: netWorthHistory(netWorth),
      income: flowHistory(cashflow, cashflow.income),
      expenses: flowHistory(cashflow, cashflow.expense),
      investments: investmentHistory(investments),
    },
    series: {
      netWorth: forecastPoints(forecast.series.netWorth),
      income: forecastPoints(forecast.series.income),
      expenses: forecastPoints(forecast.series.expense),
      investments: forecastPoints(forecast.series.investment),
      contributions: forecastPoints(forecast.series.contribution),
      savingsContributions: forecastPoints(forecast.series.savingsContribution),
      investmentReturnContributions: forecastPoints(forecast.series.investmentReturnContribution),
    },
    summary: {
      startingNetWorth: forecast.summary.startingNetWorth,
      startingPortfolioValue: forecast.summary.startingInvestments,
      historicalInvestmentReturnRate: forecast.historicalPortfolioReturn?.cagr ?? null,
      historicalInvestmentReturnMonths: forecast.historicalPortfolioReturn?.period.months ?? 0,
    },
  };
}
