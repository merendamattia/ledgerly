import type { TickerType } from "@prisma/client";
import { yahooProvider } from "./providers/yahoo.ts";
import type { SearchCandidate } from "./providers/types.ts";
import { logger } from "../../core/logger.ts";

/**
 * Search tracked-instrument candidates for a free-text query. Yahoo serves
 * equities, ETFs and crypto; an optional `type` filters the merged results. This
 * is a user-initiated provider call (not a read path), so it lives here.
 */
export async function searchInstruments(
  query: string,
  type?: TickerType,
): Promise<SearchCandidate[]> {
  try {
    const candidates = await yahooProvider.search(query);
    return type ? candidates.filter((c) => c.type === type) : candidates;
  } catch (error) {
    logger.warn("Instrument search provider failed", { error: String(error) });
    return [];
  }
}
