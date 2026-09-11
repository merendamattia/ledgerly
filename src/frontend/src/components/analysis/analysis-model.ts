export const FORECAST_HORIZONS = [1, 2, 5, 10, 15, 20] as const;
export type ForecastHorizon = (typeof FORECAST_HORIZONS)[number];

export type ForecastPoint = {
  date: string;
  mean: number;
  p10: number;
  p25: number;
  p50: number;
  p75: number;
  p90: number;
};

export type HistoricalPoint = { date: string; value: number; contribution?: number };

export type ForecastSnapshot = {
  id: string;
  generatedAt: string;
  sourceDataCutoff: string;
  currency: string;
  effectiveLookbackMonths: number;
  observationCount: number;
  simulationCount: number;
  dataQuality: "HIGH" | "MEDIUM" | "LOW";
  assumptions: string[];
  history: {
    netWorth: HistoricalPoint[];
    income: HistoricalPoint[];
    expenses: HistoricalPoint[];
    investments: HistoricalPoint[];
  };
  series: {
    netWorth: ForecastPoint[];
    income: ForecastPoint[];
    expenses: ForecastPoint[];
    investments: ForecastPoint[];
    contributions: ForecastPoint[];
  };
  summary: {
    startingNetWorth: number;
    savingsContribution: number;
    investmentReturnContribution: number;
    startingPortfolioValue: number;
    historicalInvestmentReturnRate: number | null;
    historicalInvestmentReturnMonths: number;
  };
};

export type ForecastResponse = {
  status: "EMPTY" | "GENERATING" | "READY" | "FAILED";
  snapshot: ForecastSnapshot | null;
  error?: string | null;
};

export type ForecastViewState =
  | "loading"
  | "empty"
  | "ready"
  | "refreshing"
  | "stale-error"
  | "error";

export type AnalysisMetric = "netWorth" | "income" | "expenses" | "investments";

export type ChartSeriesDefinition = {
  key: "observed" | "p10-p90" | "p25-p75" | "mean" | "p50";
  lineStyle: "solid" | "dashed" | "none";
};

export type ForecastChartModel = {
  history: HistoricalPoint[];
  forecast: ForecastPoint[];
  todayIndex: number;
  series: ChartSeriesDefinition[];
  secondarySeries?: { key: "contributions"; forecast: ForecastPoint[] };
};

/** Reduces an already-loaded maximum forecast to a selected local horizon. */
export function sliceForecast(snapshot: ForecastSnapshot, years: ForecastHorizon): ForecastSnapshot {
  const months = years * 12;
  return {
    ...snapshot,
    series: {
      netWorth: snapshot.series.netWorth.slice(0, months),
      income: snapshot.series.income.slice(0, months),
      expenses: snapshot.series.expenses.slice(0, months),
      investments: snapshot.series.investments.slice(0, months),
      contributions: snapshot.series.contributions.slice(0, months),
    },
  };
}

/** Derives the rendering state without discarding a valid previous forecast. */
export function forecastViewState(response?: ForecastResponse): ForecastViewState {
  if (!response) return "loading";
  if (response.status === "GENERATING" && response.snapshot) return "refreshing";
  if (response.status === "FAILED" && response.snapshot) return "stale-error";
  if (response.status === "FAILED") return "error";
  if (!response.snapshot) return "empty";
  return "ready";
}

/** Builds a chart-ready metric model while keeping history and forecast semantics explicit. */
export function buildForecastChartModel(
  snapshot: ForecastSnapshot,
  metric: AnalysisMetric,
  years: ForecastHorizon,
): ForecastChartModel {
  const sliced = sliceForecast(snapshot, years);
  const history = snapshot.history[metric].slice(-24);
  return {
    history,
    forecast: sliced.series[metric],
    todayIndex: Math.max(0, history.length - 1),
    series: [
      { key: "observed", lineStyle: "solid" },
      { key: "p10-p90", lineStyle: "none" },
      { key: "p25-p75", lineStyle: "none" },
      { key: "mean", lineStyle: "solid" },
      { key: "p50", lineStyle: "dashed" },
    ],
    ...(metric === "investments"
      ? { secondarySeries: { key: "contributions" as const, forecast: sliced.series.contributions } }
      : {}),
  };
}

/** Selects the persisted facts used by localized deterministic explanations. */
export function forecastExplanationFacts(snapshot: ForecastSnapshot, years: ForecastHorizon) {
  const sliced = sliceForecast(snapshot, years);
  const netWorth = sliced.series.netWorth.at(-1);
  return {
    netWorth: netWorth
      ? {
          start: snapshot.summary.startingNetWorth,
          p50: netWorth.p50,
          p10: netWorth.p10,
          p90: netWorth.p90,
          savingsContribution: snapshot.summary.savingsContribution,
          investmentReturnContribution: snapshot.summary.investmentReturnContribution,
        }
      : null,
    income: sliced.series.income.at(-1),
    expenses: sliced.series.expenses.at(-1),
    investments: {
      start: snapshot.summary.startingPortfolioValue,
      flowAdjustedReturnRate: snapshot.summary.historicalInvestmentReturnRate,
      observationMonths: snapshot.summary.historicalInvestmentReturnMonths,
    },
  };
}
