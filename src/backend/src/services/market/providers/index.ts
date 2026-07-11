import type { TickerType } from "@prisma/client";
import { yahooProvider } from "./yahoo.ts";
import { yahooBondProvider } from "./yahooBond.ts";
import type { PriceProvider } from "./types.ts";

/**
 * Selects the price provider for a ticker type.
 *
 * Yahoo serves equities, ETFs, crypto pairs and commodity futures with full
 * history. Bonds have no history on Yahoo (live quote only), so they use a
 * separate provider that captures one daily close from the live quote.
 */
export function getPriceProvider(type: TickerType): PriceProvider {
  return type === "BOND" ? yahooBondProvider : yahooProvider;
}

export type { PriceProvider, Bar, InstrumentMeta } from "./types.ts";
