import { prisma } from "../core/db.ts";
import { settingsRepository } from "../repositories/settings.ts";
import { getFxRate } from "./market/fx.ts";

export interface PortfolioPoint {
  date: string; // yyyy-mm-dd
  value: number; // market value in base currency
  invested: number; // cumulative net cost basis in base currency
}

function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Daily portfolio value from the first investment transaction to today, using
 * the persisted price history of every held ticker. Quantity at each day is the
 * cumulative buys − sells up to that day; the price is the latest close ≤ day.
 * FX uses the current rate (historical FX is not modelled here).
 */
export async function computeInvestmentHistory(): Promise<PortfolioPoint[]> {
  const txs = await prisma.investmentTransaction.findMany({
    include: { ticker: true },
    orderBy: { date: "asc" },
  });
  if (txs.length === 0) return [];

  const baseCurrency = await settingsRepository.baseCurrency();
  const tickerIds = [...new Set(txs.map((t) => t.tickerId))];

  // ticker -> currency, and current FX per currency.
  const currencyOf = new Map<string, string>();
  for (const t of txs) currencyOf.set(t.tickerId, t.ticker.currency);
  const fxByCurrency = new Map<string, number>();
  for (const cur of new Set(currencyOf.values())) {
    fxByCurrency.set(cur, await getFxRate(cur, baseCurrency));
  }

  // Ascending price series per ticker.
  const prices = await prisma.priceHistory.findMany({
    where: { tickerId: { in: tickerIds } },
    orderBy: { date: "asc" },
    select: { tickerId: true, date: true, close: true },
  });
  const priceByTicker = new Map<string, { date: number; close: number }[]>();
  // Ascending signed-quantity events per ticker.
  const txByTicker = new Map<string, { date: number; qty: number; cost: number }[]>();
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
    txByTicker.get(t.tickerId)!.push({ date: t.date.getTime(), qty: signedQty, cost });
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
    for (const id of tickerIds) {
      // Advance cumulative quantity + invested for txs on/before this day.
      const events = txByTicker.get(id)!;
      let tp = txPtr.get(id)!;
      let q = heldQty.get(id)!;
      while (tp < events.length && events[tp].date <= dayMs) {
        q += events[tp].qty;
        invested += events[tp].cost;
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
    points.push({ date: isoDay(day), value, invested: Math.max(0, invested) });
  }
  return points;
}
