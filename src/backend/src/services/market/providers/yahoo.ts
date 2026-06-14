import YahooFinance from "yahoo-finance2";
import type { Bar, InstrumentMeta, PriceProvider } from "./types.ts";

// In v3 the client is instantiated. Suppress interactive notices and the version
// check so the library is silent in a server context.
const yahooFinance = new YahooFinance({
  suppressNotices: ["yahooSurvey", "ripHistorical"],
  versionCheck: false,
});

// Earliest date we ask Yahoo for; the API simply returns whatever it has.
const INCEPTION = new Date("1970-01-01T00:00:00Z");

// Yahoo provider for equities, ETFs and indices.
export const yahooProvider: PriceProvider = {
  name: "yahoo",

  async fetchMeta(symbol: string): Promise<InstrumentMeta> {
    const q = await yahooFinance.quote(symbol);
    if (!q) throw new Error(`Unknown symbol: ${symbol}`);
    const name = q.longName ?? q.shortName ?? q.displayName ?? symbol;
    return {
      symbol: q.symbol ?? symbol,
      name,
      currency: q.currency ?? "USD",
    };
  },

  async fetchHistory(symbol: string, from?: Date): Promise<Bar[]> {
    const period1 = from ?? INCEPTION;
    const result = await yahooFinance.chart(symbol, { period1, interval: "1d" });
    const bars: Bar[] = [];
    for (const quote of result.quotes) {
      // Prefer adjusted close when available; fall back to raw close.
      const close = quote.adjclose ?? quote.close;
      if (quote.date && close != null) {
        bars.push({ date: new Date(quote.date), close });
      }
    }
    bars.sort((a, b) => a.date.getTime() - b.date.getTime());
    return bars;
  },
};
