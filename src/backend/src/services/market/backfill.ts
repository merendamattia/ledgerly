import type { Ticker } from "@prisma/client";
import { getPriceProvider } from "./providers/index.ts";
import { priceRepository } from "../../repositories/price.ts";
import { cacheDel } from "../../core/redis.ts";
import { logger } from "../../core/logger.ts";

function nextDay(date: Date): Date {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + 1);
  return d;
}

/**
 * Download closing prices for a ticker and persist them.
 * - Full mode (default): the entire available history (from inception).
 * - Incremental mode: only the dates after the latest stored close (used nightly).
 * Returns the number of newly inserted rows.
 */
export async function backfillTicker(
  ticker: Ticker,
  opts: { incremental?: boolean } = {},
): Promise<number> {
  const provider = getPriceProvider(ticker.type);

  let from: Date | undefined;
  if (opts.incremental) {
    const last = await priceRepository.latestDate(ticker.id);
    if (last) from = nextDay(last);
  }

  // Nothing newer than today to fetch yet (latest stored close is today/future).
  // Asking the provider for a future start date errors ("start date cannot be
  // after end date"); just report no new rows.
  if (from && from.getTime() > Date.now()) {
    logger.info("Backfill skipped — already up to date", {
      symbol: ticker.symbol,
      from: from.toISOString(),
    });
    return 0;
  }

  const bars = await provider.fetchHistory(ticker.symbol, from);
  const inserted = await priceRepository.bulkInsert(ticker.id, bars);

  // The latest-price cache may now be stale.
  await cacheDel(`price:${ticker.id}:latest`);

  logger.info("Backfill complete", {
    symbol: ticker.symbol,
    provider: provider.name,
    incremental: Boolean(opts.incremental),
    inserted,
  });

  return inserted;
}
