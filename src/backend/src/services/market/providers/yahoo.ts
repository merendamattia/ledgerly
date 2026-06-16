import YahooFinance from "yahoo-finance2";
import type { Bar, InstrumentMeta, PriceProvider, SearchCandidate } from "./types.ts";

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

  async search(query: string): Promise<SearchCandidate[]> {
    const result = await yahooFinance.search(query, { quotesCount: 10, newsCount: 0 });
    // Keep only equities and ETFs (crypto is served by CoinGecko).
    const matches = result.quotes.filter(
      (q): q is typeof q & { symbol: string; quoteType: "EQUITY" | "ETF" } =>
        "symbol" in q && (q.quoteType === "EQUITY" || q.quoteType === "ETF"),
    );
    if (matches.length === 0) return [];

    // Attach live prices + currency from a batch quote (best effort).
    const symbols = matches.map((m) => m.symbol);
    const quotes = await yahooFinance.quote(symbols).catch(() => []);
    const bySymbol = new Map(quotes.map((q) => [q.symbol, q]));

    return matches.map((m) => {
      const q = bySymbol.get(m.symbol);
      const name =
        ("longname" in m && m.longname) || ("shortname" in m && m.shortname) || m.symbol;
      const exchange = "exchDisp" in m && typeof m.exchDisp === "string" ? m.exchDisp : undefined;
      return {
        symbol: m.symbol,
        name: String(name),
        type: m.quoteType,
        exchange,
        currency: q?.currency,
        price: q?.regularMarketPrice,
      } satisfies SearchCandidate;
    });
  },
};
