// Pure statistics helpers (no I/O).

/** Period-over-period simple returns of a value series: r[i] = v[i]/v[i-1] − 1. */
export function returns(series: number[]): number[] {
  const out: number[] = [];
  for (let i = 1; i < series.length; i++) {
    const prev = series[i - 1];
    out.push(prev !== 0 ? series[i] / prev - 1 : 0);
  }
  return out;
}

/** Beta of an asset vs a benchmark: cov(asset, bench) / var(bench). 0 if undefined. */
export function beta(assetReturns: number[], benchReturns: number[]): number {
  const n = Math.min(assetReturns.length, benchReturns.length);
  if (n < 2) return 0;
  let sa = 0;
  let sb = 0;
  for (let i = 0; i < n; i++) {
    sa += assetReturns[i];
    sb += benchReturns[i];
  }
  const ma = sa / n;
  const mb = sb / n;
  let cov = 0;
  let varB = 0;
  for (let i = 0; i < n; i++) {
    const da = assetReturns[i] - ma;
    const db = benchReturns[i] - mb;
    cov += da * db;
    varB += db * db;
  }
  return varB > 0 ? cov / varB : 0;
}
