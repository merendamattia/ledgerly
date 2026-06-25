import type { TickerType } from "@prisma/client";
import { yahooProvider } from "./yahoo.ts";
import type { PriceProvider } from "./types.ts";

/**
 * Selects the price provider for a ticker type.
 *
 * Yahoo currently serves every supported provider-backed asset class: equities,
 * ETFs, crypto pairs, and commodity futures.
 */
export function getPriceProvider(_type: TickerType): PriceProvider {
  return yahooProvider;
}

export type { PriceProvider, Bar, InstrumentMeta } from "./types.ts";
