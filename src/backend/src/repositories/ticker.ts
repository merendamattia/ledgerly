import type { Prisma, TickerType } from "@prisma/client";
import { prisma } from "../core/db.ts";

// Data access for tickers. The only place that issues ticker DB queries.
export const tickerRepository = {
  create(data: Prisma.TickerCreateInput) {
    return prisma.ticker.create({ data });
  },

  findById(id: string) {
    return prisma.ticker.findUnique({ where: { id } });
  },

  findBySymbol(symbol: string) {
    return prisma.ticker.findUnique({ where: { symbol } });
  },

  list() {
    return prisma.ticker.findMany({ orderBy: { symbol: "asc" } });
  },

  /** All tracked tickers, used by the nightly cron to refresh prices. */
  listAll() {
    return prisma.ticker.findMany();
  },

  delete(id: string) {
    return prisma.ticker.delete({ where: { id } });
  },

  countBySymbol(symbol: string) {
    return prisma.ticker.count({ where: { symbol } });
  },

  byType(type: TickerType) {
    return prisma.ticker.findMany({ where: { type } });
  },
};
