import type { InvestmentSide, Prisma } from "@prisma/client";
import { prisma } from "../core/db.ts";

export interface InvestmentTxFilters {
  tickerId?: string;
  side?: InvestmentSide;
  from?: Date;
  to?: Date;
  limit?: number;
  offset?: number;
}

export interface InvestmentNaturalKeyFilters {
  tickerIds?: string[];
  from?: Date;
  to?: Date;
}

/**
 * Converts investment movement filters into a Prisma where clause.
 */
function whereFromFilters(f: InvestmentTxFilters): Prisma.InvestmentTransactionWhereInput {
  return {
    tickerId: f.tickerId,
    side: f.side,
    date: f.from || f.to ? { gte: f.from ?? undefined, lte: f.to ?? undefined } : undefined,
  };
}

// Data access for investment buy/sell movements.
export const investmentTransactionRepository = {
  list(userId: string, filters: InvestmentTxFilters = {}) {
    return prisma.investmentTransaction.findMany({
      where: { userId, ...whereFromFilters(filters) },
      include: { ticker: true, cashAccount: true },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      take: filters.limit,
      skip: filters.offset,
    });
  },

  /** All movements for a ticker, oldest first — used to recompute its holding. */
  listByTicker(userId: string, tickerId: string) {
    return prisma.investmentTransaction.findMany({
      where: { userId, tickerId },
      orderBy: [{ date: "asc" }, { createdAt: "asc" }],
    });
  },

  /** All movements for one user, oldest first, for portfolio calculations. */
  listAll(userId: string) {
    return prisma.investmentTransaction.findMany({
      where: { userId },
      include: { ticker: true, cashAccount: true },
      orderBy: [{ date: "asc" }, { createdAt: "asc" }],
    });
  },

  findById(userId: string, id: string) {
    return prisma.investmentTransaction.findFirst({
      where: { id, userId },
      include: { ticker: true, cashAccount: true },
    });
  },

  /** Minimal fields needed to dedup an import against existing movements. */
  async naturalKeys(userId: string, filters: InvestmentNaturalKeyFilters = {}) {
    if (filters.tickerIds?.length === 0) return [];

    return prisma.investmentTransaction.findMany({
      where: {
        userId,
        tickerId: filters.tickerIds ? { in: filters.tickerIds } : undefined,
        date:
          filters.from || filters.to
            ? { gte: filters.from ?? undefined, lte: filters.to ?? undefined }
            : undefined,
      },
      select: { tickerId: true, date: true, side: true, quantity: true, price: true },
    });
  },

  create(userId: string, data: Omit<Prisma.InvestmentTransactionCreateInput, "user">) {
    return prisma.investmentTransaction.create({
      data: { ...data, user: { connect: { id: userId } } },
      include: { ticker: true, cashAccount: true },
    });
  },

  createMany(userId: string, data: Omit<Prisma.InvestmentTransactionCreateManyInput, "userId">[]) {
    return prisma.investmentTransaction.createMany({
      data: data.map((row) => ({ ...row, userId })),
    });
  },

  async update(userId: string, id: string, data: Prisma.InvestmentTransactionUpdateInput) {
    if (!(await this.findById(userId, id))) return null;
    return prisma.investmentTransaction.update({
      where: { id },
      data,
      include: { ticker: true, cashAccount: true },
    });
  },

  async delete(userId: string, id: string) {
    if (!(await this.findById(userId, id))) return null;
    return prisma.investmentTransaction.delete({ where: { id } });
  },
};
