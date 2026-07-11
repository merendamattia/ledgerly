import type { TickerType } from "@prisma/client";
import { yahooProvider } from "./providers/yahoo.ts";
import { yahooBondProvider } from "./providers/yahooBond.ts";
import type { SearchCandidate } from "./providers/types.ts";
import { cacheGet, cacheSet } from "../../core/redis.ts";
import { logger } from "../../core/logger.ts";

const SEARCH_TTL_SECONDS = 60 * 5; // short-lived: quotes in results can move
const ISIN_RE = /^[A-Z]{2}[A-Z0-9]{9}[0-9]$/;

/**
 * Builds the Redis key for a normalized provider search query.
 */
function searchCacheKey(query: string): string {
  return `instrument-search:${encodeURIComponent(query.trim().toUpperCase())}`;
}

/**
 * Search tracked-instrument candidates for a free-text query. Yahoo serves
 * equities, ETFs and crypto; an optional `type` filters the merged results. This
 * is a user-initiated provider call (not a read path), so it lives here.
 */
export async function searchInstruments(
  query: string,
  type?: TickerType,
): Promise<SearchCandidate[]> {
  const normalized = query.trim();
  if (normalized.length === 0) return [];

  try {
    const key = searchCacheKey(normalized);
    const cached = await cacheGet<SearchCandidate[]>(key);
    let candidates: SearchCandidate[];
    if (cached) {
      candidates = cached;
    } else {
      // An ISIN resolves to a bond via a live quote (Yahoo doesn't index bonds
      // by ISIN in its text search), so query the bond provider too and prepend.
      const isIsin = ISIN_RE.test(normalized.toUpperCase());
      const [general, bonds] = await Promise.all([
        yahooProvider.search(normalized),
        isIsin ? yahooBondProvider.search(normalized) : Promise.resolve([]),
      ]);
      candidates = [...bonds, ...general];
      await cacheSet(key, candidates, SEARCH_TTL_SECONDS);
    }
    return type ? candidates.filter((c) => c.type === type) : candidates;
  } catch (error) {
    logger.warn("Instrument search provider failed", { error: String(error) });
    return [];
  }
}
