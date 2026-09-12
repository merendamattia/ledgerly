export const FINANCIAL_FORECAST_HORIZON_MONTHS = 240;
export const DEFAULT_FINANCIAL_FORECAST_SIMULATIONS = 10_000;
export const FINANCIAL_FORECAST_LOOKBACK_MONTHS = 12;

export type MonthlyAmount = { date: string; value: number };
export type MonthlyObservation = {
  month: string;
  income: number;
  expenses: number;
  investmentContributions: number;
  investmentFees: number;
};
export type RecurringForecastMonth = MonthlyObservation;

export type PercentilePoint = {
  date: string;
  mean: number;
  p10: number;
  p25: number;
  p50: number;
  p75: number;
  p90: number;
  min: number;
  max: number;
};

export type NetWorthContributionPoint = {
  date: string;
  savings: number;
  marketReturn: number;
};

export type InvestmentReturnSummary = {
  observationMonths: number;
  cagr: number | null;
  annualizedArithmeticReturn: number | null;
  annualizedVolatility: number | null;
  fallback: "NO_RELIABLE_MARKET_HISTORY" | null;
};

export type FinancialForecastInputs = {
  cutoff: Date;
  baseCurrency: string;
  current: {
    cash: number;
    credits: number;
    otherAssets: number;
    investments: number;
    marketInvestments: number;
    fallbackInvestments: number;
    debts: number;
    total: number;
    allocation?: Record<string, number>;
  };
  monthlyObservations: MonthlyObservation[];
  recurringFuture: RecurringForecastMonth[];
  investmentReturns: number[];
  historical: {
    netWorth: MonthlyAmount[];
    income: MonthlyAmount[];
    expenses: MonthlyAmount[];
    investments: MonthlyAmount[];
    contributions: MonthlyAmount[];
  };
  investmentReturn: InvestmentReturnSummary;
};

export type FinancialForecastPayload = {
  hasData: boolean;
  baseCurrency: string;
  current: FinancialForecastInputs["current"];
  historical: FinancialForecastInputs["historical"];
  series: {
    netWorth: PercentilePoint[];
    income: PercentilePoint[];
    expenses: PercentilePoint[];
    investments: PercentilePoint[];
    surplus: PercentilePoint[];
  };
  contributions: {
    netWorth: NetWorthContributionPoint[];
  };
  summary: {
    averageMonthlyIncome: number;
    averageMonthlyExpenses: number;
    averageMonthlyContributions: number;
    incomeVariability: number;
    expenseVariability: number;
    investmentReturn: InvestmentReturnSummary;
  };
  assumptions: {
    effectiveLookbackMonths: number;
    observationMonths: number;
    dataQuality: "NONE" | "REDUCED" | "STANDARD";
    recurringMovementsIncluded: boolean;
    flatComponents: string[];
    investmentFallback: {
      treatment: "HELD_FLAT";
      value: number;
    } | null;
  };
};

export type ForecastOptions = {
  horizonMonths?: number;
  simulationCount?: number;
  random?: () => number;
};

/** Linear-interpolated quantile for a financial distribution. */
export function percentile(values: ArrayLike<number>, probability: number): number {
  if (values.length === 0) return 0;
  const sorted = Array.from(values).sort((a, b) => a - b);
  return percentileSorted(sorted, probability);
}

function percentileSorted(sorted: number[], probability: number): number {
  const position = Math.max(0, Math.min(1, probability)) * (sorted.length - 1);
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (position - lower);
}

function finite(value: number): number {
  return Number.isFinite(value) ? value : 0;
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function standardDeviation(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = average(values);
  return Math.sqrt(average(values.map((value) => (value - mean) ** 2)));
}

function addUtcMonths(date: Date, months: number): string {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1))
    .toISOString()
    .slice(0, 10);
}

function distributionPoint(date: string, values: Float64Array, mean: number): PercentilePoint {
  const sorted = Array.from(values).sort((a, b) => a - b);
  return {
    date,
    mean: finite(mean),
    p10: finite(percentileSorted(sorted, 0.1)),
    p25: finite(percentileSorted(sorted, 0.25)),
    p50: finite(percentileSorted(sorted, 0.5)),
    p75: finite(percentileSorted(sorted, 0.75)),
    p90: finite(percentileSorted(sorted, 0.9)),
    min: finite(sorted[0]),
    max: finite(sorted[sorted.length - 1]),
  };
}

function randomIndex(length: number, random: () => number): number {
  if (length < 2) return 0;
  return Math.min(length - 1, Math.max(0, Math.floor(random() * length)));
}

/** Stable seeded PRNG used to make production runs traceable and tests repeatable. */
export function mulberry32(seed: number): () => number {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let next = value;
    next = Math.imul(next ^ (next >>> 15), next | 1);
    next ^= next + Math.imul(next ^ (next >>> 7), next | 61);
    return ((next ^ (next >>> 14)) >>> 0) / 4_294_967_296;
  };
}

/**
 * Builds aggregate monthly time-weighted returns. The change in cumulative net
 * invested capital is removed from the market-value change, so buys and sells
 * are never interpreted as performance. A half-period flow weight is the
 * Modified Dietz fallback when exact intramonth flow timing is unavailable.
 */
export function computeFlowAdjustedMonthlyReturns(
  points: { date: string; value: number; netContributions: number }[],
): number[] {
  const monthEnds = new Map<string, (typeof points)[number]>();
  for (const point of points) monthEnds.set(point.date.slice(0, 7), point);
  const ordered = [...monthEnds.values()].sort((a, b) => a.date.localeCompare(b.date));
  const returns: number[] = [];
  for (let index = 1; index < ordered.length; index++) {
    const start = ordered[index - 1];
    const end = ordered[index];
    const flow = finite(end.netContributions - start.netContributions);
    const denominator = start.value + flow * 0.5;
    if (denominator <= 0) continue;
    const value = (end.value - start.value - flow) / denominator;
    returns.push(Math.max(-0.99, finite(value)));
  }
  return returns;
}

/** Bootstrap Monte Carlo engine. All historical/request I/O stays outside it. */
export function buildFinancialForecast(
  input: FinancialForecastInputs,
  options: ForecastOptions = {},
): FinancialForecastPayload {
  const horizonMonths = options.horizonMonths ?? FINANCIAL_FORECAST_HORIZON_MONTHS;
  const simulationCount = options.simulationCount ?? DEFAULT_FINANCIAL_FORECAST_SIMULATIONS;
  const random = options.random ?? Math.random;
  const observations = input.monthlyObservations.length
    ? input.monthlyObservations
    : [{ month: input.cutoff.toISOString().slice(0, 7) + "-01", income: 0, expenses: 0, investmentContributions: 0, investmentFees: 0 }];
  const returns = input.investmentReturns.length ? input.investmentReturns : [0];
  const metrics = ["netWorth", "income", "expenses", "investments", "surplus"] as const;
  const distributions = Object.fromEntries(
    metrics.map((metric) => [metric, Array.from({ length: horizonMonths }, () => new Float64Array(simulationCount))]),
  ) as Record<(typeof metrics)[number], Float64Array[]>;
  const sums = Object.fromEntries(metrics.map((metric) => [metric, new Float64Array(horizonMonths)])) as Record<
    (typeof metrics)[number],
    Float64Array
  >;
  const contributionSums = {
    savings: new Float64Array(horizonMonths),
    marketReturn: new Float64Array(horizonMonths),
  };

  for (let simulation = 0; simulation < simulationCount; simulation++) {
    let cash = finite(input.current.cash);
    let marketInvestments = Math.max(0, finite(input.current.marketInvestments));
    let fallbackInvestments = Math.max(0, finite(input.current.fallbackInvestments));
    let cumulativeSavings = 0;
    let cumulativeMarketReturn = 0;
    const fixedNetWorth = finite(input.current.credits + input.current.otherAssets - input.current.debts);
    for (let month = 0; month < horizonMonths; month++) {
      const sampled = observations[randomIndex(observations.length, random)];
      const known = input.recurringFuture[month] ?? {
        income: 0,
        expenses: 0,
        investmentContributions: 0,
        investmentFees: 0,
      };
      const income = Math.max(0, finite(sampled.income + known.income));
      const expenses = Math.max(0, finite(sampled.expenses + known.expenses));
      const requestedContribution = finite(
        sampled.investmentContributions + known.investmentContributions,
      );
      const investmentsBeforeContribution = marketInvestments + fallbackInvestments;
      const contribution = Math.max(-investmentsBeforeContribution, requestedContribution);
      const marketShare =
        investmentsBeforeContribution > 0
          ? marketInvestments / investmentsBeforeContribution
          : input.investmentReturns.length > 0
            ? 1
            : 0;
      const marketContribution = contribution * marketShare;
      const fallbackContribution = contribution - marketContribution;
      const investmentFees = Math.max(
        0,
        finite(sampled.investmentFees + known.investmentFees),
      );
      const marketReturn = Math.max(-0.99, finite(returns[randomIndex(returns.length, random)]));
      cash = finite(cash + income - expenses - investmentFees - contribution);
      const marketPrincipal = Math.max(0, finite(marketInvestments + marketContribution));
      const marketReturnAmount = finite(marketPrincipal * marketReturn);
      marketInvestments = Math.max(0, finite(marketPrincipal + marketReturnAmount));
      fallbackInvestments = Math.max(0, finite(fallbackInvestments + fallbackContribution));
      const investments = marketInvestments + fallbackInvestments;
      cumulativeSavings = finite(cumulativeSavings + income - expenses - investmentFees);
      cumulativeMarketReturn = finite(cumulativeMarketReturn + marketReturnAmount);
      const values = {
        netWorth: finite(cash + investments + fixedNetWorth),
        income,
        expenses,
        investments,
        surplus: finite(income - expenses - investmentFees),
      };
      for (const metric of metrics) {
        distributions[metric][month][simulation] = values[metric];
        sums[metric][month] += values[metric];
      }
      contributionSums.savings[month] += cumulativeSavings;
      contributionSums.marketReturn[month] += cumulativeMarketReturn;
    }
  }

  const series = Object.fromEntries(
    metrics.map((metric) => [
      metric,
      distributions[metric].map((values, month) =>
        distributionPoint(
          addUtcMonths(input.cutoff, month + 1),
          values,
          sums[metric][month] / simulationCount,
        ),
      ),
    ]),
  ) as FinancialForecastPayload["series"];
  const netWorthContributions = Array.from({ length: horizonMonths }, (_, month) => ({
    date: addUtcMonths(input.cutoff, month + 1),
    savings: finite(contributionSums.savings[month] / simulationCount),
    marketReturn: finite(contributionSums.marketReturn[month] / simulationCount),
  }));
  const lookbackMonths = Math.min(
    FINANCIAL_FORECAST_LOOKBACK_MONTHS,
    input.monthlyObservations.length,
  );
  const observedIncome = input.historical.income
    .slice(-lookbackMonths)
    .map((month) => month.value);
  const observedExpenses = input.historical.expenses
    .slice(-lookbackMonths)
    .map((month) => month.value);
  const observedContributions = input.historical.contributions
    .slice(-lookbackMonths)
    .map((month) => month.value);
  const hasData =
    input.historical.netWorth.length > 0 ||
    input.monthlyObservations.length > 0 ||
    input.current.total !== 0;

  return {
    hasData,
    baseCurrency: input.baseCurrency,
    current: input.current,
    historical: input.historical,
    series,
    contributions: { netWorth: netWorthContributions },
    summary: {
      averageMonthlyIncome: average(observedIncome),
      averageMonthlyExpenses: average(observedExpenses),
      averageMonthlyContributions: average(observedContributions),
      incomeVariability: standardDeviation(observedIncome),
      expenseVariability: standardDeviation(observedExpenses),
      investmentReturn: input.investmentReturn,
    },
    assumptions: {
      effectiveLookbackMonths: lookbackMonths,
      observationMonths: input.monthlyObservations.length,
      dataQuality: !hasData
        ? "NONE"
        : input.monthlyObservations.length < FINANCIAL_FORECAST_LOOKBACK_MONTHS
          ? "REDUCED"
          : "STANDARD",
      recurringMovementsIncluded: input.recurringFuture.some(
        (month) => month.income !== 0 || month.expenses !== 0 || month.investmentContributions !== 0,
      ),
      flatComponents: ["credits", "otherAssets", "debts"],
      investmentFallback:
        input.current.fallbackInvestments > 0
          ? { treatment: "HELD_FLAT", value: input.current.fallbackInvestments }
          : null,
    },
  };
}
