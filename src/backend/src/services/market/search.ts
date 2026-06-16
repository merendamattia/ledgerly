import type { TickerType } from "@prisma/client";
import { yahooProvider } from "./providers/yahoo.ts";
import { coingeckoProvider } from "./providers/coingecko.ts";
import type { SearchCandidate } from "./providers/types.ts";
import { logger } from "../../core/logger.ts";

/**
 * Search tracked-instrument candidates for a free-text query. Equities/ETFs come
 * from Yahoo, crypto from CoinGecko; with no `type` filter we merge both. This is
 * a user-initiated provider call (not a read path), so it lives in services/market.
 */
export async function searchInstruments(
  query: string,
  type?: TickerType,
): Promise<SearchCandidate[]> {
  const providers =
    type === "CRYPTO"
      ? [coingeckoProvider]
      : type
        ? [yahooProvider]
        : [yahooProvider, coingeckoProvider];

  const results = await Promise.allSettled(providers.map((p) => p.search(query)));
  const candidates: SearchCandidate[] = [];
  for (const r of results) {
    if (r.status === "fulfilled") candidates.push(...r.value);
    else logger.warn("Instrument search provider failed", { error: String(r.reason) });
  }
  return candidates;
}
