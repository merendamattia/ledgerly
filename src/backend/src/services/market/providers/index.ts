import type { TickerType } from "@prisma/client";
import { yahooProvider } from "./yahoo.ts";
import type { PriceProvider } from "./types.ts";

// Select the price provider for a ticker type. Yahoo serves everything —
// equities, ETFs and crypto (the latter as "<COIN>-USD" pairs).
export function getPriceProvider(_type: TickerType): PriceProvider {
  return yahooProvider;
}

export type { PriceProvider, Bar, InstrumentMeta } from "./types.ts";
