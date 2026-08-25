export type MatrixDeltaPeriod = "month" | "year";

/** Compares a live value with the exact current-period monthly boundary. */
export function currentPeriodDelta(
  current: number | null,
  values: readonly (number | null)[],
  months: readonly string[],
  period: MatrixDeltaPeriod,
  asOf: Date = new Date(),
): number | null {
  if (current == null) return null;

  const year = asOf.getUTCFullYear();
  const month = period === "month" ? asOf.getUTCMonth() + 1 : 1;
  const boundary = `${year}-${String(month).padStart(2, "0")}-01`;
  const boundaryIndex = months.indexOf(boundary);
  if (boundaryIndex < 0) return null;

  const baseline = values[boundaryIndex];
  if (baseline == null || baseline === 0) return null;
  return ((current - baseline) / Math.abs(baseline)) * 100;
}
