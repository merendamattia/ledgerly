// A single daily closing price.
export interface Bar {
  date: Date;
  close: number;
}

// Metadata resolved for a symbol when an asset is first added.
export interface InstrumentMeta {
  symbol: string;
  name: string;
  currency: string;
}

// A single instrument matched while searching. `price` is a live quote (best
// effort) in `currency`; `isin` is best effort and often absent.
export interface SearchCandidate {
  symbol: string;
  name: string;
  type: "EQUITY" | "ETF" | "CRYPTO";
  exchange?: string;
  currency?: string;
  price?: number;
  isin?: string;
}

// Common interface for price providers. Implementations are the ONLY code that
// talks to external market data services, and only the backfill/cron services
// call them — never the frontend read path.
export interface PriceProvider {
  readonly name: string;
  /** Resolve human-readable metadata (name, currency) for a symbol. */
  fetchMeta(symbol: string): Promise<InstrumentMeta>;
  /** Daily closing prices from `from` (or inception) up to today, ascending by date. */
  fetchHistory(symbol: string, from?: Date): Promise<Bar[]>;
  /** Find instruments matching a free-text query (symbol or name), with live prices. */
  search(query: string): Promise<SearchCandidate[]>;
}
