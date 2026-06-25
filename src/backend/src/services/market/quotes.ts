import { priceRepository } from "../../repositories/price.ts";
import { cacheGet, cacheSet, cacheDel } from "../../core/redis.ts";

const PRICE_TTL_SECONDS = 60 * 15; // 15 min

export interface Quote {
  close: number;
  date: Date;
}

/**
 * Latest close for a ticker. Cache-first: Redis, then the PriceHistory table.
 * This read path NEVER calls external providers — prices are populated only by
 * the backfill and nightly cron services.
 */
export async function latestPrice(tickerId: string): Promise<Quote | null> {
  const key = `price:${tickerId}:latest`;
  const cached = await cacheGet<{ close: number; date: string }>(key);
  if (cached) return { close: cached.close, date: new Date(cached.date) };

  const row = await priceRepository.latest(tickerId);
  if (!row) return null;

  const quote: Quote = { close: Number(row.close), date: row.date };
  await cacheSet(key, { close: quote.close, date: quote.date.toISOString() }, PRICE_TTL_SECONDS);
  return quote;
}

/**
 * Drops the cached latest quote after a price-history write.
 */
export async function invalidatePrice(tickerId: string): Promise<void> {
  await cacheDel(`price:${tickerId}:latest`);
}
