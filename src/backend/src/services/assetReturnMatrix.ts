import { prisma } from "../core/db.ts";

export interface AssetReturnMatrixRow {
  id: string;
  name: string;
  symbol: string;
  type: string;
  currency: string;
  firstAdded: string;
  start: number | null;
  months: (number | null)[];
  returnPct: number | null;
}

export interface AssetReturnMatrixYear {
  year: number;
  nextYear: number;
  rows: AssetReturnMatrixRow[];
}

export interface AssetReturnMatrix {
  monthLabels: string[];
  years: AssetReturnMatrixYear[];
}

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function dayMsOf(d: Date): number {
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

function monthEndMs(year: number, month: number): number {
  return Date.UTC(year, month + 1, 0);
}

function valueOnOrBefore(series: { date: number; close: number }[], boundary: number): number | null {
  let lo = 0;
  let hi = series.length - 1;
  let best = -1;
  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (series[mid].date <= boundary) {
      best = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return best >= 0 ? series[best].close : null;
}

/** Annual asset-return matrix from each currently-held asset's first transaction. */
export async function computeAssetReturnMatrix(): Promise<AssetReturnMatrix> {
  const holdings = await prisma.holding.findMany({ include: { ticker: true } });
  const tickerIds = [...new Set(holdings.map((h) => h.tickerId))];
  if (tickerIds.length === 0) return { monthLabels: MONTH_LABELS, years: [] };

  const [txs, prices] = await Promise.all([
    prisma.investmentTransaction.findMany({
      where: { tickerId: { in: tickerIds } },
      orderBy: [{ date: "asc" }, { createdAt: "asc" }],
      select: { tickerId: true, date: true, price: true },
    }),
    prisma.priceHistory.findMany({
      where: { tickerId: { in: tickerIds } },
      orderBy: { date: "asc" },
      select: { tickerId: true, date: true, close: true },
    }),
  ]);
  if (txs.length === 0) return { monthLabels: MONTH_LABELS, years: [] };

  const txByTicker = new Map<string, typeof txs>();
  const providerByTicker = new Map(holdings.map((h) => [h.tickerId, h.ticker.provider]));
  for (const tx of txs) {
    const arr = txByTicker.get(tx.tickerId) ?? [];
    arr.push(tx);
    txByTicker.set(tx.tickerId, arr);
  }

  const pricesByTicker = new Map<string, { date: number; close: number }[]>();
  for (const price of prices) {
    const arr = pricesByTicker.get(price.tickerId) ?? [];
    arr.push({ date: dayMsOf(price.date), close: Number(price.close) });
    pricesByTicker.set(price.tickerId, arr);
  }

  // Transaction prices are a local fallback for sparse manual assets only.
  // Provider-backed assets must use market history, otherwise a buy price can
  // masquerade as a month-end close.
  for (const [tickerId, tickerTxs] of txByTicker) {
    if (providerByTicker.get(tickerId) !== "manual") continue;
    const arr = pricesByTicker.get(tickerId) ?? [];
    const seen = new Set(arr.map((point) => point.date));
    for (const tx of tickerTxs) {
      const date = dayMsOf(tx.date);
      if (!seen.has(date)) {
        arr.push({ date, close: Number(tx.price) });
        seen.add(date);
      }
    }
    arr.sort((a, b) => a.date - b.date);
    pricesByTicker.set(tickerId, arr);
  }

  const firstDates = [...txByTicker.values()].map((rows) => dayMsOf(rows[0].date));
  const firstYear = new Date(Math.min(...firstDates)).getUTCFullYear();
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const todayMs = today.getTime();
  const currentYear = today.getUTCFullYear();
  const sortedHoldings = [...holdings].sort((a, b) =>
    a.ticker.type.localeCompare(b.ticker.type) || a.ticker.symbol.localeCompare(b.ticker.symbol),
  );

  const years: AssetReturnMatrixYear[] = [];
  for (let year = firstYear; year <= currentYear; year++) {
    const rows: AssetReturnMatrixRow[] = [];
    const yearEnd = Date.UTC(year, 11, 31);

    for (const holding of sortedHoldings) {
      const tickerTxs = txByTicker.get(holding.tickerId);
      const series = pricesByTicker.get(holding.tickerId) ?? [];
      if (!tickerTxs?.length || series.length === 0) continue;

      const firstAddedMs = dayMsOf(tickerTxs[0].date);
      if (firstAddedMs > yearEnd) continue;

      const start = valueOnOrBefore(series, Date.UTC(year - 1, 11, 31));
      const months = MONTH_LABELS.map((_, month) => {
        const monthStart = Date.UTC(year, month, 1);
        if (monthStart > todayMs || monthEndMs(year, month) < firstAddedMs) return null;
        return valueOnOrBefore(series, Math.min(monthEndMs(year, month), todayMs));
      });
      const end = [...months].reverse().find((value): value is number => value != null) ?? null;

      rows.push({
        id: holding.tickerId,
        name: holding.ticker.name,
        symbol: holding.ticker.symbol,
        type: holding.ticker.type,
        currency: holding.ticker.currency,
        firstAdded: isoDay(tickerTxs[0].date),
        start,
        months,
        returnPct: start != null && start !== 0 && end != null ? (end / start - 1) * 100 : null,
      });
    }

    if (rows.length > 0) years.push({ year, nextYear: year + 1, rows });
  }

  return { monthLabels: MONTH_LABELS, years };
}
