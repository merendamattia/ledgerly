import { Prisma, type PriceHistory } from "@prisma/client";
import { prisma } from "../core/db.ts";
import type { Bar } from "../services/market/providers/types.ts";

// Data access for the daily price history table.
export const priceRepository = {
  /** Insert bars, skipping rows that already exist for (tickerId, date). Returns inserted count. */
  async bulkInsert(tickerId: string, bars: Bar[]): Promise<number> {
    if (bars.length === 0) return 0;
    const res = await prisma.priceHistory.createMany({
      data: bars.map((b) => ({ tickerId, date: b.date, close: b.close })),
      skipDuplicates: true,
    });
    return res.count;
  },

  /** Upsert bars, correcting existing historical closes when a repair backfill runs. */
  async bulkUpsert(tickerId: string, bars: Bar[]): Promise<number> {
    // ponytail: repair path, sequential is fine; batch SQL if full-history repairs get slow.
    for (const b of bars) {
      await prisma.priceHistory.upsert({
        where: { tickerId_date: { tickerId, date: b.date } },
        create: { tickerId, date: b.date, close: b.close },
        update: { close: b.close },
      });
    }
    return bars.length;
  },

  /** Insert or update a single daily close (used for manual price entry). */
  upsert(tickerId: string, date: Date, close: number) {
    return prisma.priceHistory.upsert({
      where: { tickerId_date: { tickerId, date } },
      create: { tickerId, date, close },
      update: { close },
    });
  },

  /** Most recent stored date for a ticker, or null if none. */
  async latestDate(tickerId: string): Promise<Date | null> {
    const row = await prisma.priceHistory.findFirst({
      where: { tickerId },
      orderBy: { date: "desc" },
      select: { date: true },
    });
    return row?.date ?? null;
  },

  /** Most recent stored close for a ticker. */
  latest(tickerId: string) {
    return prisma.priceHistory.findFirst({
      where: { tickerId },
      orderBy: { date: "desc" },
    });
  },

  /** Most recent stored close for each ticker, in one Postgres query. */
  async latestByTickerIds(tickerIds: string[]): Promise<Map<string, PriceHistory>> {
    const ids = [...new Set(tickerIds)];
    if (ids.length === 0) return new Map();

    const rows = await prisma.$queryRaw<PriceHistory[]>(Prisma.sql`
      SELECT DISTINCT ON ("tickerId") id, "tickerId", date, close
      FROM "price_history"
      WHERE "tickerId" IN (${Prisma.join(ids)})
      ORDER BY "tickerId", date DESC
    `);
    return new Map(rows.map((row) => [row.tickerId, row]));
  },

  /** Full ascending close series for a ticker (for benchmark comparison). */
  series(tickerId: string) {
    return prisma.priceHistory.findMany({
      where: { tickerId },
      orderBy: { date: "asc" },
      select: { date: true, close: true },
    });
  },

  seriesByTickerIds(tickerIds: string[]) {
    return prisma.priceHistory.findMany({
      where: { tickerId: { in: tickerIds } },
      orderBy: { date: "asc" },
      select: { tickerId: true, date: true, close: true },
    });
  },

  /** Latest close on or before a given date (for historical valuations). */
  onOrBefore(tickerId: string, date: Date) {
    return prisma.priceHistory.findFirst({
      where: { tickerId, date: { lte: date } },
      orderBy: { date: "desc" },
    });
  },

  count(tickerId: string) {
    return prisma.priceHistory.count({ where: { tickerId } });
  },

  async countByTickerIds(tickerIds: string[]): Promise<Map<string, number>> {
    if (tickerIds.length === 0) return new Map();
    const rows = await prisma.priceHistory.groupBy({
      by: ["tickerId"],
      where: { tickerId: { in: tickerIds } },
      _count: { _all: true },
    });
    return new Map(rows.map((row) => [row.tickerId, row._count._all]));
  },
};
