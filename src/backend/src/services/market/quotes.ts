import { priceRepository } from "../../repositories/price.ts";
import { cacheGet, cacheSet, cacheDel } from "../../core/redis.ts";

const PRICE_TTL_SECONDS = 60 * 15; // 15 min
type CachedQuote = { close: number; date: string };

export interface Quote {
  close: number;
  date: Date;
}

function priceCacheKey(tickerId: string): string {
  return `price:${tickerId}:latest`;
}

function fromCache(cached: CachedQuote): Quote {
  return { close: cached.close, date: new Date(cached.date) };
}

function cachePayload(quote: Quote): CachedQuote {
  return { close: quote.close, date: quote.date.toISOString() };
}

/**
 * Latest close for a ticker. Cache-first: Redis, then the PriceHistory table.
 * This read path NEVER calls external providers — prices are populated only by
 * the backfill and nightly cron services.
 */
export async function latestPrice(tickerId: string): Promise<Quote | null> {
  return (await latestPrices([tickerId])).get(tickerId) ?? null;
}

/** Latest closes for many tickers. Redis-first, then one DB query for cache misses. */
export async function latestPrices(tickerIds: string[]): Promise<Map<string, Quote>> {
  const ids = [...new Set(tickerIds)];
  const quotes = new Map<string, Quote>();
  if (ids.length === 0) return quotes;

  const misses: string[] = [];
  await Promise.all(
    ids.map(async (tickerId) => {
      const cached = await cacheGet<CachedQuote>(priceCacheKey(tickerId));
      if (cached) {
        quotes.set(tickerId, fromCache(cached));
      } else {
        misses.push(tickerId);
      }
    }),
  );

  if (misses.length === 0) return quotes;

  const rows = await priceRepository.latestByTickerIds(misses);
  await Promise.all(
    [...rows].map(async ([tickerId, row]) => {
      const quote = { close: Number(row.close), date: row.date };
      quotes.set(tickerId, quote);
      await cacheSet(priceCacheKey(tickerId), cachePayload(quote), PRICE_TTL_SECONDS);
    }),
  );
  return quotes;
}

/**
 * Drops the cached latest quote after a price-history write.
 */
export async function invalidatePrice(tickerId: string): Promise<void> {
  await cacheDel(priceCacheKey(tickerId));
}
