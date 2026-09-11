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
    savingsContributions: ForecastPoint[];
    investmentReturnContributions: ForecastPoint[];
  };
  summary: {
    startingNetWorth: number;
    startingPortfolioValue: number;
    historicalInvestmentReturnRate: number | null;
    historicalInvestmentReturnMonths: number;
  };
};

export type ForecastResponse =
  | { status: "EMPTY"; snapshot: null; error?: null }
  | { status: "GENERATING"; snapshot: ForecastSnapshot | null; error?: null }
  | { status: "READY"; snapshot: ForecastSnapshot; error?: null }
  | { status: "FAILED"; snapshot: ForecastSnapshot | null; error: string };
