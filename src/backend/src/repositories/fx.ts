import { prisma } from "../core/db.ts";
import type { FxBar } from "../services/market/providers/frankfurter.ts";

// Data access for historical FX rates.
export const fxRepository = {
  async bulkInsert(base: string, quote: string, bars: FxBar[]): Promise<number> {
    if (bars.length === 0) return 0;
    const res = await prisma.fxRate.createMany({
      data: bars.map((b) => ({ base, quote, date: b.date, rate: b.rate })),
      skipDuplicates: true,
    });
    return res.count;
  },

  async latestDate(base: string, quote: string): Promise<Date | null> {
    const row = await prisma.fxRate.findFirst({
      where: { base, quote },
      orderBy: { date: "desc" },
      select: { date: true },
    });
    return row?.date ?? null;
  },

  /** Latest rate on or before a date, used for converting historical values. */
  onOrBefore(base: string, quote: string, date: Date) {
    return prisma.fxRate.findFirst({
      where: { base, quote, date: { lte: date } },
      orderBy: { date: "desc" },
    });
  },

  latest(base: string, quote: string) {
    return prisma.fxRate.findFirst({
      where: { base, quote },
      orderBy: { date: "desc" },
    });
  },
};
