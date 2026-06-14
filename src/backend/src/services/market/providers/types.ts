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

// Common interface for price providers. Implementations are the ONLY code that
// talks to external market data services, and only the backfill/cron services
// call them — never the frontend read path.
export interface PriceProvider {
  readonly name: string;
  /** Resolve human-readable metadata (name, currency) for a symbol. */
  fetchMeta(symbol: string): Promise<InstrumentMeta>;
  /** Daily closing prices from `from` (or inception) up to today, ascending by date. */
  fetchHistory(symbol: string, from?: Date): Promise<Bar[]>;
}
