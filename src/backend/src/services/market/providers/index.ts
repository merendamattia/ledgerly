import type { TickerType } from "@prisma/client";
import { yahooProvider } from "./yahoo.ts";
import { coingeckoProvider } from "./coingecko.ts";
import type { PriceProvider } from "./types.ts";

// Select the price provider for a ticker type. Equities, ETFs and indices use
// Yahoo; crypto uses CoinGecko.
export function getPriceProvider(type: TickerType): PriceProvider {
  return type === "CRYPTO" ? coingeckoProvider : yahooProvider;
}

export type { PriceProvider, Bar, InstrumentMeta } from "./types.ts";
