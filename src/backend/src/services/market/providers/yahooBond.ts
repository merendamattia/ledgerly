import { yahooFinance } from "./yahoo.ts";
import type { Bar, InstrumentMeta, PriceProvider, SearchCandidate } from "./types.ts";

// Yahoo has NO daily-close history for bonds (chart() returns 0 bars) and does
// not index them by ISIN in search — but it DOES expose a live quote under
// "<ISIN>.<exchange>". So bonds can't be backfilled; instead the nightly cron
// captures one live quote per day. `fetchHistory` returns only today's bar and
// `backfillTicker` appends it, reusing the whole price pipeline.
//
// Exchange suffixes, best-first. Stuttgart (.SG) prices Italian govt bonds
// cleanly in EUR; TLX (.TI) exists but returns junk (currency null, absurd
// open/close), so it is the last resort.
const BOND_SUFFIXES = [".SG", ".MI", ".F", ".TI"] as const;
const ISIN_RE = /^[A-Z]{2}[A-Z0-9]{9}[0-9]$/;

/** UTC midnight for today (matches the @db.Date price column). */
function todayUtc(): Date {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

// A usable bond listing: a positive price. Validation is disabled because
// yahoo-finance2's schema rejects quoteType "BOND" outright.
interface BondQuote {
  symbol: string;
  price: number;
  currency: string;
  name: string;
}

/** Resolve the best live listing for a bond symbol/ISIN, trying each exchange. */
async function resolveBond(symbolOrIsin: string): Promise<BondQuote | null> {
  const base = symbolOrIsin.trim().toUpperCase();
  const isin = base.split(".")[0]!;
  // Already suffixed (e.g. "IT0005024234.SG") → try it as-is first.
  const candidates = base.includes(".") ? [base] : BOND_SUFFIXES.map((s) => base + s);

  // Take the price from the best-priced venue (EUR preferred — Stuttgart is
  // clean), but the display name from any venue that carries one (some quote a
  // real name like "TITOLI DI STATO ITALIA", others none), so the two can differ.
  let priced: BondQuote | null = null;
  let name: string | null = null;
  for (const sym of candidates) {
    try {
      const q = (await yahooFinance.quote(sym, {}, { validateResult: false })) as {
        symbol?: string;
        regularMarketPrice?: number;
        currency?: string;
        shortName?: string;
        longName?: string;
      };
      name ??= q?.longName ?? q?.shortName ?? null;
      const price = q?.regularMarketPrice;
      if (!q?.symbol || price == null || price <= 0) continue;
      const hit: BondQuote = { symbol: q.symbol, price, currency: q.currency ?? "EUR", name: "" };
      if (q.currency === "EUR") {
        priced = hit;
        if (name) break; // clean EUR price + a real name → done
      }
      priced ??= hit;
    } catch {
      // Unknown symbol on this exchange — try the next suffix.
    }
  }
  if (!priced) return null;
  priced.name = name ?? isin;
  return priced;
}

/** Provider for bonds: live-quote only (no history), resolved via ISIN + exchange suffix. */
export const yahooBondProvider: PriceProvider = {
  name: "yahoo-bond",

  async fetchMeta(symbol: string): Promise<InstrumentMeta> {
    const bond = await resolveBond(symbol);
    if (!bond) throw new Error(`No bond listing found for: ${symbol}`);
    return { symbol: bond.symbol, name: bond.name, currency: bond.currency };
  },

  // No historical series exists — return only today's live close. The nightly
  // incremental backfill calls this once a day and appends one row.
  async fetchHistory(symbol: string, from?: Date): Promise<Bar[]> {
    const today = todayUtc();
    if (from && from.getTime() > today.getTime()) return [];
    const bond = await resolveBond(symbol);
    if (!bond) return [];
    return [{ date: today, close: bond.price }];
  },

  async search(query: string): Promise<SearchCandidate[]> {
    const isin = query.trim().toUpperCase();
    if (!ISIN_RE.test(isin)) return [];
    const bond = await resolveBond(isin);
    if (!bond) return [];
    return [
      {
        symbol: bond.symbol,
        name: bond.name,
        type: "BOND",
        currency: bond.currency,
        price: bond.price,
        isin,
      },
    ];
  },
};
