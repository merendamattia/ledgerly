import { prisma } from "../core/db.ts";
import type { Bar } from "../services/market/providers/types.ts";

export type ProviderPriceSource = {
  provider: string;
  symbol: string;
};

/** Stable identity for shared provider-backed market data. */
export function providerPriceKey(source: ProviderPriceSource): string {
  return `${source.provider}\u0000${source.symbol}`;
}

function uniqueSources(sources: ProviderPriceSource[]): ProviderPriceSource[] {
  const seen = new Set<string>();
  return sources.filter((source) => {
    const key = providerPriceKey(source);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Data access for shared provider/symbol price history. */
export const providerPriceRepository = {
  bulkInsert(source: ProviderPriceSource, bars: Bar[]) {
    if (bars.length === 0) return Promise.resolve(0);
    return prisma.providerPriceHistory
      .createMany({
        data: bars.map((bar) => ({
          provider: source.provider,
          symbol: source.symbol,
          date: bar.date,
          close: bar.close,
        })),
        skipDuplicates: true,
      })
      .then((result) => result.count);
  },

  async bulkUpsert(source: ProviderPriceSource, bars: Bar[]): Promise<number> {
    for (const bar of bars) {
      await prisma.providerPriceHistory.upsert({
        where: {
          provider_symbol_date: {
            provider: source.provider,
            symbol: source.symbol,
            date: bar.date,
          },
        },
        create: {
          provider: source.provider,
          symbol: source.symbol,
          date: bar.date,
          close: bar.close,
        },
        update: { close: bar.close },
      });
    }
    return bars.length;
  },

  latestDate(source: ProviderPriceSource) {
    return prisma.providerPriceHistory.findFirst({
      where: { provider: source.provider, symbol: source.symbol },
      orderBy: { date: "desc" },
      select: { date: true },
    });
  },

  latest(source: ProviderPriceSource) {
    return prisma.providerPriceHistory.findFirst({
      where: { provider: source.provider, symbol: source.symbol },
      orderBy: { date: "desc" },
      });
  },

  latestBySources(sources: ProviderPriceSource[]) {
    const unique = uniqueSources(sources);
    if (unique.length === 0) return Promise.resolve(new Map());

    return prisma.providerPriceHistory
      .findMany({
        where: {
          OR: unique.map((source) => ({ provider: source.provider, symbol: source.symbol })),
        },
        orderBy: [{ provider: "asc" }, { symbol: "asc" }, { date: "desc" }],
        select: { provider: true, symbol: true, date: true, close: true },
      })
      .then((rows) => {
        const latest = new Map<string, (typeof rows)[number]>();
        for (const row of rows) {
          const key = providerPriceKey(row);
          if (!latest.has(key)) latest.set(key, row);
        }
        return latest;
      });
  },

  series(source: ProviderPriceSource) {
    return prisma.providerPriceHistory.findMany({
      where: { provider: source.provider, symbol: source.symbol },
      orderBy: { date: "asc" },
      select: { date: true, close: true },
    });
  },

  seriesBySources(sources: ProviderPriceSource[]) {
    const unique = uniqueSources(sources);
    if (unique.length === 0) return Promise.resolve(new Map());

    return prisma.providerPriceHistory
      .findMany({
        where: {
          OR: unique.map((source) => ({ provider: source.provider, symbol: source.symbol })),
        },
        orderBy: [{ provider: "asc" }, { symbol: "asc" }, { date: "asc" }],
        select: { provider: true, symbol: true, date: true, close: true },
      })
      .then((rows) => {
        const series = new Map<string, { date: Date; close: (typeof rows)[number]["close"] }[]>();
        for (const row of rows) {
          const key = providerPriceKey(row);
          const points = series.get(key) ?? [];
          points.push({ date: row.date, close: row.close });
          series.set(key, points);
        }
        return series;
      });
  },

  onOrBefore(source: ProviderPriceSource, date: Date) {
    return prisma.providerPriceHistory.findFirst({
      where: { provider: source.provider, symbol: source.symbol, date: { lte: date } },
      orderBy: { date: "desc" },
      select: { date: true, close: true },
    });
  },
};
