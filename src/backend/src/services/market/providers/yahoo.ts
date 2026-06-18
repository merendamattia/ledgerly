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
    // A future start date makes Yahoo throw ("start date cannot be after end
    // date"); there are no bars to return for a range that hasn't happened yet.
    if (period1.getTime() > Date.now()) return [];
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
    // An ISIN-shaped query (2 letters, 9 alphanumerics, 1 check digit) — Yahoo
    // resolves these to a listing whose quoteType may be unusual (e.g. a BTP), so
    // we keep all results for ISIN lookups and default the unknown ones to BOND.
    const isin = query.trim().toUpperCase();
    const isIsin = /^[A-Z]{2}[A-Z0-9]{9}[0-9]$/.test(isin);

    const matches = result.quotes.filter(
      (q): q is typeof q & { symbol: string; quoteType: string } =>
        "symbol" in q &&
        typeof (q as { symbol?: unknown }).symbol === "string" &&
        (mapQuoteType((q as { quoteType?: string }).quoteType) !== null || isIsin),
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
        // Unknown quote types only survive the filter for ISIN lookups → BOND.
        type: mapQuoteType(m.quoteType) ?? "BOND",
        exchange,
        currency: q?.currency,
        price: q?.regularMarketPrice,
        isin: isIsin ? isin : undefined,
      } satisfies SearchCandidate;
    });
  },
};

// Map a Yahoo quoteType to our TickerType, or null if we don't track it. Crypto
// is served as "<COIN>-USD" pairs (CRYPTOCURRENCY); commodities as futures.
function mapQuoteType(quoteType: string | undefined): SearchCandidate["type"] | null {
  switch (quoteType) {
    case "EQUITY":
      return "EQUITY";
    case "ETF":
      return "ETF";
    case "CRYPTOCURRENCY":
      return "CRYPTO";
    case "FUTURE":
      return "COMMODITY";
    default:
      return null;
  }
}
