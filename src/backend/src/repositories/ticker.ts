import type { Prisma, TickerType } from "@prisma/client";
import { prisma } from "../core/db.ts";

// Data access for tickers. The only place that issues ticker DB queries.
export const tickerRepository = {
  create(userId: string, data: Omit<Prisma.TickerCreateInput, "user">) {
    return prisma.ticker.create({ data: { ...data, user: { connect: { id: userId } } } });
  },

  findById(userId: string, id: string) {
    return prisma.ticker.findFirst({ where: { id, userId } });
  },

  findBySymbol(userId: string, symbol: string) {
    return prisma.ticker.findFirst({ where: { userId, symbol } });
  },

  list(userId: string) {
    return prisma.ticker.findMany({ where: { userId }, orderBy: { symbol: "asc" } });
  },

  /** All tracked tickers, used by the nightly cron to refresh prices. */
  listAll() {
    return prisma.ticker.findMany();
  },

  async rename(userId: string, id: string, name: string) {
    if (!(await this.findById(userId, id))) return null;
    return prisma.ticker.update({ where: { id }, data: { name } });
  },

  async delete(userId: string, id: string) {
    if (!(await this.findById(userId, id))) return null;
    return prisma.ticker.delete({ where: { id } });
  },

  countBySymbol(userId: string, symbol: string) {
    return prisma.ticker.count({ where: { userId, symbol } });
  },

  byType(userId: string, type: TickerType) {
    return prisma.ticker.findMany({ where: { userId, type } });
  },
};
