export const HORIZON_OPTIONS = [1, 2, 5, 10, 15, 20].map((years) => ({
  years,
  months: years * 12,
}));

export type ForecastPoint = {
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

export type ForecastChartRow = ForecastPoint & {
  actual: number | null;
  historicalOverlay: number | null;
  today: boolean;
};

export type NetWorthContributionPoint = {
  date: string;
  savings: number;
  marketReturn: number;
};

export const horizonMonths = (years: number) => years * 12;

/** Prevents unstructured AI prose from bypassing numeric privacy masking. */
export function visibleAiInterpretation<T>(
  interpretation: T | null | undefined,
  shouldHidePrivateNumbers: boolean,
): T | null {
  return shouldHidePrivateNumbers ? null : interpretation ?? null;
}

/** Slices the one persisted maximum series; it never requests or calculates. */
export function sliceForecastSeries(series: ForecastPoint[], years: number): ForecastPoint[] {
  return series.slice(0, horizonMonths(years));
}

/** Selects deterministic explanation metrics from the same cached horizon as the chart. */
export function buildNetWorthExplanation({
  years,
  currentValue,
  forecast,
  contributions,
}: {
  years: number;
  currentValue: number;
  forecast: ForecastPoint[];
  contributions: NetWorthContributionPoint[];
}) {
  const endpoint = forecast[horizonMonths(years) - 1];
  const contribution = contributions[horizonMonths(years) - 1];
  return {
    startingValue: currentValue,
    median: endpoint?.p50 ?? currentValue,
    p10: endpoint?.p10 ?? currentValue,
    p90: endpoint?.p90 ?? currentValue,
    savingsContribution: contribution?.savings ?? 0,
    marketReturnContribution: contribution?.marketReturn ?? 0,
  };
}

/** Joins observed history and the forecast fan at one explicit Today point. */
export function buildForecastChartRows({
  history,
  historicalOverlay,
  forecast,
  cutoff,
  currentValue,
}: {
  history: { date: string; value: number }[];
  historicalOverlay?: { date: string; value: number }[];
  forecast: ForecastPoint[];
  cutoff: string;
  currentValue: number;
}): ForecastChartRow[] {
  const overlayByMonth = new Map(
    historicalOverlay?.map((point) => [point.date.slice(0, 7), point.value]) ?? [],
  );
  const actual = history
    .filter((point) => point.date !== cutoff)
    .slice(-24)
    .map((point) => ({
      date: point.date,
      actual: point.value,
      historicalOverlay: overlayByMonth.get(point.date.slice(0, 7)) ?? null,
      today: false,
      mean: Number.NaN,
      p10: Number.NaN,
      p25: Number.NaN,
      p50: Number.NaN,
      p75: Number.NaN,
      p90: Number.NaN,
      min: Number.NaN,
      max: Number.NaN,
    }));
  const boundary: ForecastChartRow = {
    date: cutoff,
    actual: currentValue,
    historicalOverlay: null,
    today: true,
    mean: currentValue,
    p10: currentValue,
    p25: currentValue,
    p50: currentValue,
    p75: currentValue,
    p90: currentValue,
    min: currentValue,
    max: currentValue,
  };
  return [
    ...actual,
    boundary,
    ...forecast.map((point) => ({
      ...point,
      actual: null,
      historicalOverlay: null,
      today: false,
    })),
  ];
}
