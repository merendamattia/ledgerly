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
  list(filters: InvestmentTxFilters = {}) {
    return prisma.investmentTransaction.findMany({
      where: whereFromFilters(filters),
      include: { ticker: true, cashAccount: true },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      take: filters.limit,
      skip: filters.offset,
    });
  },

  /** All movements for a ticker, oldest first — used to recompute its holding. */
  listByTicker(tickerId: string) {
    return prisma.investmentTransaction.findMany({
      where: { tickerId },
      orderBy: [{ date: "asc" }, { createdAt: "asc" }],
    });
  },

  findById(id: string) {
    return prisma.investmentTransaction.findUnique({
      where: { id },
      include: { ticker: true, cashAccount: true },
    });
  },

  /** Minimal fields needed to dedup an import against existing movements. */
  async naturalKeys(filters: InvestmentNaturalKeyFilters = {}) {
    if (filters.tickerIds?.length === 0) return [];

    return prisma.investmentTransaction.findMany({
      where: {
        tickerId: filters.tickerIds ? { in: filters.tickerIds } : undefined,
        date:
          filters.from || filters.to
            ? { gte: filters.from ?? undefined, lte: filters.to ?? undefined }
            : undefined,
      },
      select: { tickerId: true, date: true, side: true, quantity: true, price: true },
    });
  },

  create(data: Prisma.InvestmentTransactionCreateInput) {
    return prisma.investmentTransaction.create({
      data,
      include: { ticker: true, cashAccount: true },
    });
  },

  createMany(data: Prisma.InvestmentTransactionCreateManyInput[]) {
    return prisma.investmentTransaction.createMany({ data });
  },

  update(id: string, data: Prisma.InvestmentTransactionUpdateInput) {
    return prisma.investmentTransaction.update({
      where: { id },
      data,
      include: { ticker: true, cashAccount: true },
    });
  },

  delete(id: string) {
    return prisma.investmentTransaction.delete({ where: { id } });
  },
};
