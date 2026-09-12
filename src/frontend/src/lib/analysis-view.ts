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
  today: boolean;
};

export const horizonMonths = (years: number) => years * 12;

/** Slices the one persisted maximum series; it never requests or calculates. */
export function sliceForecastSeries(series: ForecastPoint[], years: number): ForecastPoint[] {
  return series.slice(0, horizonMonths(years));
}

/** Joins observed history and the forecast fan at one explicit Today point. */
export function buildForecastChartRows({
  history,
  forecast,
  cutoff,
  currentValue,
}: {
  history: { date: string; value: number }[];
  forecast: ForecastPoint[];
  cutoff: string;
  currentValue: number;
}): ForecastChartRow[] {
  const actual = history
    .filter((point) => point.date !== cutoff)
    .slice(-24)
    .map((point) => ({
      date: point.date,
      actual: point.value,
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
    ...forecast.map((point) => ({ ...point, actual: null, today: false })),
  ];
}
