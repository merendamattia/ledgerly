import { settingsRepository } from "../repositories/settings.ts";
import { investmentTransactionRepository } from "../repositories/investmentTransaction.ts";
import { priceRepository } from "../repositories/price.ts";
import { getFxRate, type FxRateResolver } from "./market/fx.ts";

export interface PortfolioCashFlowEvent {
  date: string;
  side: "BUY" | "SELL";
  amount: number;
  grossAmount: number;
}

export interface PortfolioPoint {
  date: string; // yyyy-mm-dd
  value: number; // market value in base currency
  invested: number; // cumulative net cost basis in base currency
  /** Signed cumulative buy cost minus sale proceeds for forecast flow adjustment. */
  cashFlow?: number;
  /** True when one or more investment movements occurred on this date. */
  cashFlowActivity?: boolean;
  /** Dated movements used to reconcile investment and categorized cash-flow sources. */
  cashFlowEvents?: PortfolioCashFlowEvent[];
}

/** Keeps only transactions for tickers with at least one persisted price. */
export function priceBackedTransactions<T extends { tickerId: string }>(
  transactions: T[],
  prices: { tickerId: string }[],
): T[] {
  const pricedTickerIds = new Set(prices.map((price) => price.tickerId));
  return transactions.filter((transaction) => pricedTickerIds.has(transaction.tickerId));
}

/**
 * Formats a Date as the yyyy-mm-dd key used by portfolio history points.
 */
function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Daily portfolio value from the first investment transaction to today, using
 * the persisted price history of every held ticker. Quantity at each day is the
 * cumulative buys − sells up to that day; the price is the latest close ≤ day.
 * FX uses the current rate (historical FX is not modelled here).
 */
export async function computeInvestmentHistory(
  userId: string,
  options: {
    providerBackedOnly?: boolean;
    resolveFxRate?: FxRateResolver;
    includeCashFlowEvents?: boolean;
  } = {},
): Promise<PortfolioPoint[]> {
  const resolveFxRate = options.resolveFxRate ?? getFxRate;
  const [allTransactions, baseCurrency] = await Promise.all([
    investmentTransactionRepository.listAll(userId),
    settingsRepository.baseCurrency(userId),
  ]);
  const candidates = options.providerBackedOnly
    ? allTransactions.filter((transaction) => transaction.ticker.provider !== "manual")
    : allTransactions;
  if (candidates.length === 0) return [];

  const tickerIds = [...new Set(candidates.map((t) => t.tickerId))];

  // ticker -> currency, and current FX per currency.
  const currencyOf = new Map<string, string>();
  for (const t of candidates) currencyOf.set(t.tickerId, t.ticker.currency);
  const currencies = [...new Set(currencyOf.values())];

  // Ascending price series per ticker.
  const [prices, fxEntries] = await Promise.all([
    Promise.all(
      tickerIds.map(async (tickerId) =>
        (await priceRepository.series(tickerId)).map((point) => ({ ...point, tickerId })),
      ),
    ).then((series) => series.flat()),
    Promise.all(currencies.map(async (cur) => [cur, (await resolveFxRate(cur, baseCurrency)) ?? 1] as const)),
  ]);
  const txs = options.providerBackedOnly
    ? priceBackedTransactions(candidates, prices)
    : candidates;
  if (txs.length === 0) return [];
  const fxByCurrency = new Map<string, number>(fxEntries);
  const priceByTicker = new Map<string, { date: number; close: number }[]>();
  // Ascending signed-quantity events per ticker.
  const txByTicker = new Map<string, {
    date: number;
    qty: number;
    cost: number;
    side: "BUY" | "SELL";
    grossAmount: number;
  }[]>();
  for (const id of tickerIds) {
    priceByTicker.set(id, []);
    txByTicker.set(id, []);
  }
  for (const p of prices) {
    priceByTicker.get(p.tickerId)!.push({ date: p.date.getTime(), close: Number(p.close) });
  }
  for (const t of txs) {
    const fx = fxByCurrency.get(t.ticker.currency) ?? 1;
    const signedQty = t.side === "BUY" ? Number(t.quantity) : -Number(t.quantity);
    // Net invested: + (qty*price+fee) on buy, − (qty*price−fee) on sell.
    const gross = Number(t.quantity) * Number(t.price);
    const cost = (t.side === "BUY" ? gross + Number(t.fee) : -(gross - Number(t.fee))) * fx;
    txByTicker.get(t.tickerId)!.push({
      date: t.date.getTime(),
      qty: signedQty,
      cost,
      side: t.side,
      grossAmount: gross * fx,
    });
  }

  const startMs = txs[0].date.getTime();
  const start = new Date(startMs);
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  // Forward-scan pointers per ticker (days iterate monotonically).
  const pricePtr = new Map<string, number>();
  const txPtr = new Map<string, number>();
  const heldQty = new Map<string, number>();
  for (const id of tickerIds) {
    pricePtr.set(id, -1);
    txPtr.set(id, 0);
    heldQty.set(id, 0);
  }
  let invested = 0;

  const points: PortfolioPoint[] = [];
  const day = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()));
  for (; day.getTime() <= today.getTime(); day.setUTCDate(day.getUTCDate() + 1)) {
    const dayMs = day.getTime();
    let value = 0;
    const cashFlowEvents: PortfolioCashFlowEvent[] = [];
    for (const id of tickerIds) {
      // Advance cumulative quantity + invested for txs on/before this day.
      const events = txByTicker.get(id)!;
      let tp = txPtr.get(id)!;
      let q = heldQty.get(id)!;
      while (tp < events.length && events[tp].date <= dayMs) {
        q += events[tp].qty;
        invested += events[tp].cost;
        if (events[tp].date === dayMs) {
          cashFlowEvents.push({
            date: isoDay(new Date(events[tp].date)),
            side: events[tp].side,
            amount: events[tp].cost,
            grossAmount: events[tp].grossAmount,
          });
        }
        tp++;
      }
      txPtr.set(id, tp);
      heldQty.set(id, q);

      // Advance to the latest close on/before this day.
      const ph = priceByTicker.get(id)!;
      let pp = pricePtr.get(id)!;
      while (pp + 1 < ph.length && ph[pp + 1].date <= dayMs) pp++;
      pricePtr.set(id, pp);

      if (q > 0 && pp >= 0) {
        const fx = fxByCurrency.get(currencyOf.get(id)!) ?? 1;
        value += q * ph[pp].close * fx;
      }
    }
    const point: PortfolioPoint = {
      date: isoDay(day),
      value,
      invested: Math.max(0, invested),
      cashFlow: Number.isFinite(invested) ? invested : 0,
    };
    if (options.includeCashFlowEvents) {
      point.cashFlowActivity = cashFlowEvents.length > 0;
      point.cashFlowEvents = cashFlowEvents;
    }
    points.push(point);
  }
  return points;
}
