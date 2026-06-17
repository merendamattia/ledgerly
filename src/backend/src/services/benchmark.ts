import { priceRepository } from "../repositories/price.ts";
import { tickerRepository } from "../repositories/ticker.ts";
import { computeInvestmentHistory } from "./investmentHistory.ts";
import { beta, returns } from "../utils/stats.ts";

// MSCI World benchmark: iShares Core MSCI World UCITS ETF (Amsterdam listing).
const BENCHMARK_SYMBOL = "IWDA.AS";
const BENCHMARK_NAME = "MSCI World";

export interface BenchmarkPoint {
  date: string; // yyyy-mm-dd
  portfolio: number; // performance index, rebased to 100 at the window start
  benchmark: number; // performance index, rebased to 100 at the window start
}

export type BenchmarkComparison =
  | { available: false }
  | {
      available: true;
      benchmarkSymbol: string;
      benchmarkName: string;
      series: BenchmarkPoint[];
      portfolioReturnPct: number;
      benchmarkReturnPct: number;
      beta: number;
    };

/**
 * Compares the portfolio's performance against a market benchmark (MSCI World,
 * held in the DB as IWDA.AS). Both lines are rebased to 100 at the first common
 * day so they overlay as growth indices.
 *
 * The portfolio index is contribution-neutral: it tracks value/invested (a
 * break-even multiple), so new buys don't distort it — only market moves do.
 * The benchmark index tracks the IWDA.AS close (return % is FX-agnostic while
 * the benchmark currency is constant). Beta is regressed from daily returns.
 *
 * Returns `{ available: false }` when IWDA.AS (or its price history) is absent,
 * so the UI can show a placeholder instead of a broken chart.
 */
export async function computeBenchmarkComparison(): Promise<BenchmarkComparison> {
  const ticker = await tickerRepository.findBySymbol(BENCHMARK_SYMBOL);
  if (!ticker) return { available: false };

  const [portfolio, bench] = await Promise.all([
    computeInvestmentHistory(),
    priceRepository.series(ticker.id),
  ]);
  if (portfolio.length === 0 || bench.length === 0) return { available: false };

  // Ascending benchmark closes; walk a pointer to the latest close ≤ each day.
  const benchSeries = bench.map((b) => ({ ms: b.date.getTime(), close: Number(b.close) }));
  let bp = -1;

  const dates: string[] = [];
  const portRatio: number[] = []; // value / invested
  const benchClose: number[] = [];
  for (const p of portfolio) {
    if (p.invested <= 0 || p.value <= 0) continue;
    const dayMs = new Date(p.date).getTime();
    while (bp + 1 < benchSeries.length && benchSeries[bp + 1].ms <= dayMs) bp++;
    if (bp < 0) continue; // no benchmark close yet on this day
    dates.push(p.date);
    portRatio.push(p.value / p.invested);
    benchClose.push(benchSeries[bp].close);
  }
  if (dates.length < 2) return { available: false };

  const r0 = portRatio[0];
  const b0 = benchClose[0];
  const series: BenchmarkPoint[] = dates.map((date, i) => ({
    date,
    portfolio: (portRatio[i] / r0) * 100,
    benchmark: (benchClose[i] / b0) * 100,
  }));

  const portReturnPct = (portRatio.at(-1)! / r0 - 1) * 100;
  const benchReturnPct = (benchClose.at(-1)! / b0 - 1) * 100;

  return {
    available: true,
    benchmarkSymbol: BENCHMARK_SYMBOL,
    benchmarkName: BENCHMARK_NAME,
    series,
    portfolioReturnPct: portReturnPct,
    benchmarkReturnPct: benchReturnPct,
    beta: beta(returns(portRatio), returns(benchClose)),
  };
}
