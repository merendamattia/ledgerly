import { fetchFxHistory } from "./providers/frankfurter.ts";
import { fxRepository } from "../../repositories/fx.ts";
import { cacheGet, cacheSet } from "../../core/redis.ts";

const FX_TTL_SECONDS = 60 * 60 * 12; // 12h

function nextDay(date: Date): Date {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + 1);
  return d;
}

/**
 * Download historical FX rates for base -> quote and persist them.
 * Returns the number of newly inserted rows. No-op for base === quote.
 */
export async function backfillFx(
  base: string,
  quote: string,
  opts: { incremental?: boolean } = {},
): Promise<number> {
  if (base === quote) return 0;

  let from: Date | undefined;
  if (opts.incremental) {
    const last = await fxRepository.latestDate(base, quote);
    if (last) from = nextDay(last);
  }

  // Nothing newer than today to fetch yet; a future start date makes the
  // provider reject the range ("start date cannot be after end date").
  if (from && from.getTime() > Date.now()) return 0;

  const bars = await fetchFxHistory(base, quote, from);
  return fxRepository.bulkInsert(base, quote, bars);
}

/**
 * Latest base -> quote rate. Cache-first: Redis, then Postgres. Backfills on a
 * cold miss. Never called from the frontend read path without a populated cache.
 */
export async function getFxRate(base: string, quote: string): Promise<number> {
  if (base === quote) return 1;

  const key = `fx:${base}:${quote}:latest`;
  const cached = await cacheGet<number>(key);
  if (cached != null) return cached;

  let row = await fxRepository.latest(base, quote);
  if (!row) {
    await backfillFx(base, quote);
    row = await fxRepository.latest(base, quote);
  }
  if (!row) throw new Error(`No FX rate available for ${base} -> ${quote}`);

  const rate = Number(row.rate);
  await cacheSet(key, rate, FX_TTL_SECONDS);
  return rate;
}

/** Rate on or before a date (for historical valuations); falls back to latest. */
export async function getFxRateOn(base: string, quote: string, date: Date): Promise<number> {
  if (base === quote) return 1;
  const row = await fxRepository.onOrBefore(base, quote, date);
  if (row) return Number(row.rate);
  return getFxRate(base, quote);
}
