import type { PriceHistory, Ticker } from "@prisma/client";
import { prisma } from "../core/db.ts";
import type { Bar } from "../services/market/providers/types.ts";
import {
  providerPriceKey,
  providerPriceRepository,
  type ProviderPriceSource,
} from "./providerPrice.ts";

type PricePoint = Pick<PriceHistory, "date" | "close">;
type TickerSource = Pick<Ticker, "provider" | "symbol">;
type TickerSourceRow = TickerSource & { id: string };
type LocalPricePoint = PricePoint & { tickerId: string };

function isSharedSource(source: TickerSource): boolean {
  return source.provider !== "manual";
}

function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function mergePricePoints(shared: PricePoint[], local: PricePoint[]): PricePoint[] {
  const byDate = new Map(shared.map((point) => [dayKey(point.date), point]));
  for (const point of local) byDate.set(dayKey(point.date), point);
  return [...byDate.values()].sort((a, b) => a.date.getTime() - b.date.getTime());
}

function chooseEffectivePoint(
  local: PricePoint | undefined,
  shared: PricePoint | undefined,
): PricePoint | undefined {
  if (!local) return shared;
  if (!shared) return local;
  return local.date.getTime() >= shared.date.getTime() ? local : shared;
}

async function findTickerSource(tickerId: string) {
  return prisma.ticker.findUnique({
    where: { id: tickerId },
    select: { provider: true, symbol: true },
  });
}

async function findTickerSources(tickerIds: string[]): Promise<TickerSourceRow[]> {
  const ids = [...new Set(tickerIds)];
  if (ids.length === 0) return [];
  return prisma.ticker.findMany({
    where: { id: { in: ids } },
    select: { id: true, provider: true, symbol: true },
  });
}

function groupLocalRows(rows: LocalPricePoint[]): Map<string, PricePoint[]> {
  const grouped = new Map<string, PricePoint[]>();
  for (const { tickerId, date, close } of rows) {
    const points = grouped.get(tickerId) ?? [];
    points.push({ date, close });
    grouped.set(tickerId, points);
  }
  return grouped;
}

async function effectiveSeriesByTickerIds(
  tickerIds: string[],
): Promise<(PricePoint & { tickerId: string })[]> {
  const tickers = await findTickerSources(tickerIds);
  if (tickers.length === 0) return [];

  const localRows = await prisma.priceHistory.findMany({
    where: { tickerId: { in: tickers.map((ticker) => ticker.id) } },
    orderBy: [{ tickerId: "asc" }, { date: "asc" }],
    select: { tickerId: true, date: true, close: true },
  });
  const localByTicker = groupLocalRows(localRows);
  const sharedBySource = await providerPriceRepository.seriesBySources(
    tickers.filter(isSharedSource),
  );
  const result: (PricePoint & { tickerId: string })[] = [];

  for (const ticker of tickers) {
    const local = localByTicker.get(ticker.id) ?? [];
    const points = isSharedSource(ticker)
      ? mergePricePoints(sharedBySource.get(providerPriceKey(ticker)) ?? [], local)
      : local;
    result.push(...points.map((point) => ({ tickerId: ticker.id, ...point })));
  }

  return result.sort((a, b) => a.date.getTime() - b.date.getTime());
}

async function latestPointsByTickerIds(
  tickerIds: string[],
): Promise<Map<string, PricePoint>> {
  const tickers = await findTickerSources(tickerIds);
  if (tickers.length === 0) return new Map();

  const localRows = await prisma.priceHistory.findMany({
    where: { tickerId: { in: tickers.map((ticker) => ticker.id) } },
    orderBy: [{ tickerId: "asc" }, { date: "desc" }],
    select: { tickerId: true, date: true, close: true },
  });
  const localLatest = new Map<string, PricePoint>();
  for (const row of localRows) {
    if (!localLatest.has(row.tickerId)) localLatest.set(row.tickerId, row);
  }

  const sharedLatest = await providerPriceRepository.latestBySources(
    tickers.filter(isSharedSource),
  );
  const result = new Map<string, PricePoint>();
  for (const ticker of tickers) {
    const local = localLatest.get(ticker.id);
    const shared = sharedLatest.get(providerPriceKey(ticker));
    const point = isSharedSource(ticker) ? chooseEffectivePoint(local, shared) : local;
    if (point) result.set(ticker.id, point);
  }
  return result;
}

function asPriceHistory(tickerId: string, point: PricePoint): PriceHistory {
  return {
    id: `${tickerId}:${dayKey(point.date)}`,
    tickerId,
    date: point.date,
    close: point.close,
  };
}

/** Data access for effective ticker prices and shared provider history. */
export const priceRepository = {
  /** Insert bars, skipping rows that already exist for the ticker's price source. */
  async bulkInsert(tickerId: string, bars: Bar[]): Promise<number> {
    if (bars.length === 0) return 0;
    const source = await findTickerSource(tickerId);
    if (!source) throw new Error("Ticker not found");
    if (isSharedSource(source)) return providerPriceRepository.bulkInsert(source, bars);

    const result = await prisma.priceHistory.createMany({
      data: bars.map((bar) => ({ tickerId, date: bar.date, close: bar.close })),
      skipDuplicates: true,
    });
    return result.count;
  },

  /** Upsert bars, correcting existing historical closes for a repair backfill. */
  async bulkUpsert(tickerId: string, bars: Bar[]): Promise<number> {
    if (bars.length === 0) return 0;
    const source = await findTickerSource(tickerId);
    if (!source) throw new Error("Ticker not found");
    if (isSharedSource(source)) return providerPriceRepository.bulkUpsert(source, bars);

    for (const bar of bars) {
      await prisma.priceHistory.upsert({
        where: { tickerId_date: { tickerId, date: bar.date } },
        create: { tickerId, date: bar.date, close: bar.close },
        update: { close: bar.close },
      });
    }
    return bars.length;
  },

  /** Insert or update a ticker-local price, used for manual values and anchors. */
  upsert(tickerId: string, date: Date, close: number) {
    return prisma.priceHistory.upsert({
      where: { tickerId_date: { tickerId, date } },
      create: { tickerId, date, close },
      update: { close },
    });
  },

  /** Most recent source date used by provider backfills, or null if none. */
  async latestDate(tickerId: string): Promise<Date | null> {
    const source = await findTickerSource(tickerId);
    if (!source) return null;

    const local = prisma.priceHistory.findFirst({
      where: { tickerId },
      orderBy: { date: "desc" },
      select: { date: true },
    });
    if (!isSharedSource(source)) return (await local)?.date ?? null;

    const shared = await providerPriceRepository.latestDate(source);
    return shared?.date ?? (await local)?.date ?? null;
  },

  /** Most recent effective close for a ticker. */
  async latest(tickerId: string): Promise<PriceHistory | null> {
    const latest = await latestPointsByTickerIds([tickerId]);
    const point = latest.get(tickerId);
    return point ? asPriceHistory(tickerId, point) : null;
  },

  /** Most recent effective close for each requested ticker. */
  async latestByTickerIds(tickerIds: string[]): Promise<Map<string, PriceHistory>> {
    const latest = await latestPointsByTickerIds(tickerIds);
    return new Map(
      [...latest].map(([tickerId, point]) => [tickerId, asPriceHistory(tickerId, point)]),
    );
  },

  /** Full ascending effective close series for a ticker. */
  async series(tickerId: string): Promise<PricePoint[]> {
    const rows = await effectiveSeriesByTickerIds([tickerId]);
    return rows.map(({ tickerId: _tickerId, ...point }) => point);
  },

  /** Full ascending effective close series for many tickers. */
  seriesByTickerIds(tickerIds: string[]) {
    return effectiveSeriesByTickerIds(tickerIds);
  },

  /** Latest effective close on or before a given date. */
  async onOrBefore(tickerId: string, date: Date): Promise<PriceHistory | null> {
    const source = await findTickerSource(tickerId);
    if (!source) return null;

    const local = prisma.priceHistory.findFirst({
      where: { tickerId, date: { lte: date } },
      orderBy: { date: "desc" },
      select: { date: true, close: true },
    });
    if (!isSharedSource(source)) {
      const point = await local;
      return point ? asPriceHistory(tickerId, point) : null;
    }

    const [localPoint, sharedPoint] = await Promise.all([
      local,
      providerPriceRepository.onOrBefore(source, date),
    ]);
    const point = chooseEffectivePoint(localPoint ?? undefined, sharedPoint ?? undefined);
    return point ? asPriceHistory(tickerId, point) : null;
  },

  count(tickerId: string) {
    return this.series(tickerId).then((rows) => rows.length);
  },

  async countByTickerIds(tickerIds: string[]): Promise<Map<string, number>> {
    const counts = new Map<string, number>();
    for (const row of await this.seriesByTickerIds(tickerIds)) {
      counts.set(row.tickerId, (counts.get(row.tickerId) ?? 0) + 1);
    }
    return counts;
  },

  /** Tickers that will observe a shared-source write and need cache invalidation. */
  async tickerIdsForSource(source: ProviderPriceSource): Promise<string[]> {
    const tickers = await prisma.ticker.findMany({
      where: { provider: source.provider, symbol: source.symbol },
      select: { id: true },
    });
    return tickers.map((ticker) => ticker.id);
  },
};
