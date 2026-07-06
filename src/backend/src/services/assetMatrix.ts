import { prisma } from "../core/db.ts";
import { settingsRepository } from "../repositories/settings.ts";
import { getFxRate } from "./market/fx.ts";
import { latestPrice } from "./market/quotes.ts";

export interface MatrixRow {
  id: string; // tickerId | cashAccountId | debtId
  label: string; // ticker.symbol | account.name | debt.name
  type: "TICKER" | "CASH" | "DEBT";
  currency: string;
  current: number; // current value in base currency (the "Value" column)
  values: number[]; // base-currency value at each month boundary
}

export interface MatrixGroup {
  category: string;
  rows: MatrixRow[];
}

export interface MatrixSeriesRow {
  label: string;
  current: number | null;
  values: (number | null)[];
  digits: number; // decimal places to render
}

export interface AssetMatrix {
  baseCurrency: string;
  months: string[]; // yyyy-mm-dd, 1st of each month, ascending
  groups: MatrixGroup[]; // ordered as the spreadsheet
  summary: { netWorth: number[]; plPct: (number | null)[]; netWorthCurrent: number };
  fx: MatrixSeriesRow[]; // USDEUR, USDGBP, BTCUSD, ETHUSD (omit if unavailable)
  netWorthOther: MatrixSeriesRow[]; // USD, GBP, BTC, ETH (omit when inputs missing)
}

/** Formats a Date as the yyyy-mm-dd key used by matrix columns. */
function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Converts a Date to a UTC-midnight timestamp for step-function comparisons. */
function dayMsOf(d: Date): number {
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

/**
 * Latest value on or before each boundary from an ascending {date, val} series,
 * by a monotonic pointer scan. Returns null for boundaries before the first point.
 */
function sampleOnOrBefore(
  series: { date: number; val: number }[],
  boundaries: number[],
): (number | null)[] {
  const out: (number | null)[] = [];
  let p = -1;
  for (const b of boundaries) {
    while (p + 1 < series.length && series[p + 1].date <= b) p++;
    out.push(p < 0 ? null : series[p].val);
  }
  return out;
}

const EMPTY: AssetMatrix = {
  baseCurrency: "EUR",
  months: [],
  groups: [],
  summary: { netWorth: [], plPct: [], netWorthCurrent: 0 },
  fx: [],
  netWorthOther: [],
};

/**
 * Wide net-worth matrix: rows are individual assets grouped by category, columns
 * are month boundaries (1st of each month from the earliest event to today). Each
 * cell is the asset's value in the base currency at that boundary.
 *
 * Per-asset cells convert the asset's own currency with the CURRENT FX rate (as
 * investmentHistory/netWorthHistory do), so the Net Worth row reconciles with
 * `/dashboard/networth-history`. Only the dedicated FX rows and the
 * net-worth-in-other-currency rows below use historical FX/prices.
 */
export async function computeAssetMatrix(): Promise<AssetMatrix> {
  const [baseCurrency, txs, accounts, debtRows, cashSnaps, debtSnaps, tickers] = await Promise.all([
    settingsRepository.baseCurrency(),
    prisma.investmentTransaction.findMany({ include: { ticker: true }, orderBy: { date: "asc" } }),
    prisma.cashAccount.findMany(),
    prisma.debt.findMany(),
    prisma.cashSnapshot.findMany({ include: { cashAccount: true }, orderBy: { date: "asc" } }),
    prisma.debtSnapshot.findMany({ include: { debt: true }, orderBy: { date: "asc" } }),
    prisma.ticker.findMany(),
  ]);

  // Current FX per currency in play (cache-first, no provider on this path).
  const currencies = new Set<string>([baseCurrency]);
  for (const t of txs) currencies.add(t.ticker.currency);
  for (const a of accounts) currencies.add(a.currency);
  for (const d of debtRows) currencies.add(d.currency);
  for (const s of cashSnaps) currencies.add(s.cashAccount.currency);
  for (const s of debtSnaps) currencies.add(s.debt.currency);
  const fxByCurrency = new Map<string, number>(
    await Promise.all(
      [...currencies].map(async (cur) => [cur, await getFxRate(cur, baseCurrency)] as const),
    ),
  );
  const fx = (cur: string) => fxByCurrency.get(cur) ?? 1;

  // ── Month boundaries ──────────────────────────────────────────────────────
  const starts: number[] = [];
  if (txs.length) starts.push(dayMsOf(txs[0].date));
  for (const s of cashSnaps) starts.push(dayMsOf(s.date));
  for (const s of debtSnaps) starts.push(dayMsOf(s.date));
  for (const a of accounts) starts.push(dayMsOf(a.updatedAt));
  for (const d of debtRows) starts.push(dayMsOf(d.updatedAt));
  if (starts.length === 0) return { ...EMPTY, baseCurrency };

  const start = new Date(Math.min(...starts));
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const boundaries: number[] = [];
  const months: string[] = [];
  for (
    let m = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
    m.getTime() <= today.getTime();
    m.setUTCMonth(m.getUTCMonth() + 1)
  ) {
    boundaries.push(m.getTime());
    months.push(isoDay(m));
  }

  // ── Ticker rows (cumulative qty ≤ boundary × close ≤ boundary × current FX) ─
  const tickerMeta = new Map(tickers.map((t) => [t.id, t]));
  const tickerIds = [...new Set(txs.map((t) => t.tickerId))];
  const prices =
    tickerIds.length === 0
      ? []
      : await prisma.priceHistory.findMany({
          where: { tickerId: { in: tickerIds } },
          orderBy: { date: "asc" },
          select: { tickerId: true, date: true, close: true },
        });
  const priceByTicker = new Map<string, { date: number; close: number }[]>();
  const txByTicker = new Map<string, { date: number; qty: number }[]>();
  for (const id of tickerIds) {
    priceByTicker.set(id, []);
    txByTicker.set(id, []);
  }
  for (const p of prices) {
    priceByTicker.get(p.tickerId)!.push({ date: dayMsOf(p.date), close: Number(p.close) });
  }
  for (const t of txs) {
    const qty = t.side === "BUY" ? Number(t.quantity) : -Number(t.quantity);
    txByTicker.get(t.tickerId)!.push({ date: dayMsOf(t.date), qty });
  }
  const quoteByTicker = new Map(
    await Promise.all(tickerIds.map(async (id) => [id, await latestPrice(id)] as const)),
  );

  const tickerRowById = new Map<string, MatrixRow>();
  for (const id of tickerIds) {
    const meta = tickerMeta.get(id);
    if (!meta) continue;
    const rate = fx(meta.currency);
    const events = txByTicker.get(id)!;
    const ph = priceByTicker.get(id)!;
    const values: number[] = [];
    let tp = 0;
    let pp = -1;
    let q = 0;
    for (const b of boundaries) {
      while (tp < events.length && events[tp].date <= b) q += events[tp++].qty;
      while (pp + 1 < ph.length && ph[pp + 1].date <= b) pp++;
      values.push(q > 0 && pp >= 0 ? q * ph[pp].close * rate : 0);
    }
    // Current value from the live quote and the final cumulative quantity.
    const finalQty = events.reduce((acc, e) => acc + e.qty, 0);
    const quote = finalQty > 0 ? quoteByTicker.get(id) : null;
    const current = quote ? finalQty * quote.close * rate : 0;
    tickerRowById.set(id, {
      id,
      label: meta.symbol,
      type: "TICKER",
      currency: meta.currency,
      current,
      values,
    });
  }

  const tickerRowsByType = (predicate: (type: string) => boolean): MatrixRow[] =>
    tickerIds
      .filter((id) => tickerMeta.get(id) && predicate(tickerMeta.get(id)!.type))
      .map((id) => tickerRowById.get(id)!)
      .filter(Boolean);

  // ── Cash / Debt rows (step functions from dated snapshots + live value) ─────
  const cashStepsByAccount = new Map<string, { date: number; value: number }[]>();
  for (const s of cashSnaps) {
    const arr = cashStepsByAccount.get(s.cashAccountId) ?? [];
    arr.push({ date: dayMsOf(s.date), value: Number(s.balance) * fx(s.cashAccount.currency) });
    cashStepsByAccount.set(s.cashAccountId, arr);
  }
  for (const a of accounts) {
    const arr = cashStepsByAccount.get(a.id) ?? [];
    arr.push({ date: dayMsOf(a.updatedAt), value: Number(a.balance) * fx(a.currency) });
    arr.sort((x, y) => x.date - y.date);
    cashStepsByAccount.set(a.id, arr);
  }
  const debtStepsByDebt = new Map<string, { date: number; value: number }[]>();
  for (const s of debtSnaps) {
    const arr = debtStepsByDebt.get(s.debtId) ?? [];
    arr.push({ date: dayMsOf(s.date), value: Number(s.amount) * fx(s.debt.currency) });
    debtStepsByDebt.set(s.debtId, arr);
  }
  for (const d of debtRows) {
    const arr = debtStepsByDebt.get(d.id) ?? [];
    arr.push({ date: dayMsOf(d.updatedAt), value: Number(d.amount) * fx(d.currency) });
    arr.sort((x, y) => x.date - y.date);
    debtStepsByDebt.set(d.id, arr);
  }

  const cashRow = (a: (typeof accounts)[number]): MatrixRow => ({
    id: a.id,
    label: a.name,
    type: "CASH",
    currency: a.currency,
    current: Number(a.balance) * fx(a.currency),
    values: sampleOnOrBefore(
      (cashStepsByAccount.get(a.id) ?? []).map((s) => ({ date: s.date, val: s.value })),
      boundaries,
    ).map((v) => v ?? 0),
  });
  const debtRow = (d: (typeof debtRows)[number]): MatrixRow => ({
    id: d.id,
    label: d.name,
    type: "DEBT",
    currency: d.currency,
    current: Number(d.amount) * fx(d.currency),
    values: sampleOnOrBefore(
      (debtStepsByDebt.get(d.id) ?? []).map((s) => ({ date: s.date, val: s.value })),
      boundaries,
    ).map((v) => v ?? 0),
  });

  // ── Groups (ordered as the spreadsheet) ────────────────────────────────────
  const allGroups: MatrixGroup[] = [
    { category: "Stocks - ETF", rows: tickerRowsByType((t) => t === "ETF" || t === "EQUITY") },
    { category: "Bonds", rows: tickerRowsByType((t) => t === "BOND") },
    { category: "Crypto", rows: tickerRowsByType((t) => t === "CRYPTO") },
    {
      category: "Cash - Liquidity",
      rows: accounts.filter((a) => a.category === "LIQUIDITY" && a.type !== "BROKER").map(cashRow),
    },
    {
      category: "Others",
      rows: [
        ...accounts.filter((a) => a.category === "OTHER_ASSET").map(cashRow),
        ...tickerRowsByType((t) => t === "COMMODITY"),
      ],
    },
    {
      category: "Receivables",
      rows: accounts.filter((a) => a.category === "CREDIT").map(cashRow),
    },
    { category: "Debts", rows: debtRows.map(debtRow) },
  ];

  // Drop all-zero rows (no data anywhere → noise) and any group left empty.
  const groups = allGroups
    .map((g) => ({
      ...g,
      rows: g.rows.filter((r) => r.current !== 0 || r.values.some((v) => v !== 0)),
    }))
    .filter((g) => g.rows.length > 0);

  // ── Summary: NW per boundary summed from the matrix's own cells ─────────────
  const netWorth = boundaries.map((_, i) => {
    let sum = 0;
    for (const g of groups) {
      const sign = g.category === "Debts" ? -1 : 1;
      for (const r of g.rows) sum += sign * r.values[i];
    }
    return sum;
  });
  const plPct = netWorth.map((nw, i) =>
    i === 0 || !netWorth[i - 1] ? null : ((nw - netWorth[i - 1]) / netWorth[i - 1]) * 100,
  );
  let netWorthCurrent = 0;
  for (const g of groups) {
    const sign = g.category === "Debts" ? -1 : 1;
    for (const r of g.rows) netWorthCurrent += sign * r.current;
  }

  // ── FX rows (historical: rate/close on or before each boundary) ─────────────
  async function fiatSeries(from: string, to: string): Promise<{ date: number; val: number }[]> {
    if (from === to) return boundaries.map((date) => ({ date, val: 1 }));
    const rows = await prisma.fxRate.findMany({
      where: { base: from, quote: to },
      orderBy: { date: "asc" },
      select: { date: true, rate: true },
    });
    return rows.map((r) => ({ date: dayMsOf(r.date), val: Number(r.rate) }));
  }
  function cryptoTicker(coin: "BTC" | "ETH") {
    const re = new RegExp(`^${coin}[-/]?USD`, "i");
    return tickers.find((t) => t.type === "CRYPTO" && t.currency === "USD" && re.test(t.symbol));
  }
  async function cryptoSeries(tickerId: string): Promise<{ date: number; val: number }[]> {
    const rows = await prisma.priceHistory.findMany({
      where: { tickerId },
      orderBy: { date: "asc" },
      select: { date: true, close: true },
    });
    return rows.map((r) => ({ date: dayMsOf(r.date), val: Number(r.close) }));
  }
  async function currentQuote(tickerId: string) {
    if (quoteByTicker.has(tickerId)) return quoteByTicker.get(tickerId) ?? null;
    const quote = await latestPrice(tickerId);
    quoteByTicker.set(tickerId, quote);
    return quote;
  }

  const btc = cryptoTicker("BTC");
  const eth = cryptoTicker("ETH");
  const [usdEurSeries, usdGbpSeries, btcSeries, ethSeries] = await Promise.all([
    fiatSeries("USD", "EUR"),
    fiatSeries("USD", "GBP"),
    btc ? cryptoSeries(btc.id) : Promise.resolve(null),
    eth ? cryptoSeries(eth.id) : Promise.resolve(null),
  ]);

  const usdEur = sampleOnOrBefore(usdEurSeries, boundaries);
  const usdGbp = sampleOnOrBefore(usdGbpSeries, boundaries);
  const btcUsd = btcSeries ? sampleOnOrBefore(btcSeries, boundaries) : null;
  const ethUsd = ethSeries ? sampleOnOrBefore(ethSeries, boundaries) : null;

  const fxRows: MatrixSeriesRow[] = [
    { label: "USDEUR", current: await getFxRate("USD", "EUR"), values: usdEur, digits: 4 },
    { label: "USDGBP", current: await getFxRate("USD", "GBP"), values: usdGbp, digits: 4 },
  ];
  if (btc && btcUsd) {
    const q = await currentQuote(btc.id);
    fxRows.push({ label: "BTCUSD", current: q?.close ?? null, values: btcUsd, digits: 0 });
  }
  if (eth && ethUsd) {
    const q = await currentQuote(eth.id);
    fxRows.push({ label: "ETHUSD", current: q?.close ?? null, values: ethUsd, digits: 0 });
  }

  // ── Net worth in other currencies (historical FX/prices) ───────────────────
  const baseToUsd = sampleOnOrBefore(await fiatSeries(baseCurrency, "USD"), boundaries);
  const baseToGbp = sampleOnOrBefore(await fiatSeries(baseCurrency, "GBP"), boundaries);
  const nwUsd = netWorth.map((nw, i) => (baseToUsd[i] == null ? null : nw * baseToUsd[i]!));
  const nwGbp = netWorth.map((nw, i) => (baseToGbp[i] == null ? null : nw * baseToGbp[i]!));
  const currentUsd = await getFxRate(baseCurrency, "USD");
  const currentGbp = await getFxRate(baseCurrency, "GBP");
  const netWorthOther: MatrixSeriesRow[] = [
    { label: "NW (USD)", current: netWorthCurrent * currentUsd, values: nwUsd, digits: 2 },
    { label: "NW (GBP)", current: netWorthCurrent * currentGbp, values: nwGbp, digits: 2 },
  ];
  if (btc && btcUsd) {
    const q = await currentQuote(btc.id);
    netWorthOther.push({
      label: "NW (BTC)",
      current: q?.close ? (netWorthCurrent * currentUsd) / q.close : null,
      values: nwUsd.map((v, i) => (v == null || !btcUsd[i] ? null : v / btcUsd[i]!)),
      digits: 4,
    });
  }
  if (eth && ethUsd) {
    const q = await currentQuote(eth.id);
    netWorthOther.push({
      label: "NW (ETH)",
      current: q?.close ? (netWorthCurrent * currentUsd) / q.close : null,
      values: nwUsd.map((v, i) => (v == null || !ethUsd[i] ? null : v / ethUsd[i]!)),
      digits: 4,
    });
  }

  // ── Trim leading months with no recorded data (net worth still zero) ───────
  const startIdx = Math.max(0, netWorth.findIndex((v) => v !== 0));
  if (startIdx > 0) {
    months.splice(0, startIdx);
    for (const g of groups) for (const r of g.rows) r.values.splice(0, startIdx);
    for (const r of fxRows) r.values.splice(0, startIdx);
    for (const r of netWorthOther) r.values.splice(0, startIdx);
    netWorth.splice(0, startIdx);
    plPct.splice(0, startIdx);
    plPct[0] = null; // first visible month has no prior period
  }

  return {
    baseCurrency,
    months,
    groups,
    summary: { netWorth, plPct, netWorthCurrent },
    fx: fxRows,
    netWorthOther,
  };
}
