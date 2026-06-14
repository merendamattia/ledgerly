import type { Prisma, TxDirection } from "@prisma/client";
import { prisma } from "../core/db.ts";

export interface TransactionFilters {
  from?: Date;
  to?: Date;
  categoryId?: string;
  direction?: TxDirection;
  limit?: number;
  offset?: number;
}

function whereFromFilters(f: TransactionFilters): Prisma.TransactionWhereInput {
  return {
    categoryId: f.categoryId,
    direction: f.direction,
    date:
      f.from || f.to
        ? { gte: f.from ?? undefined, lte: f.to ?? undefined }
        : undefined,
  };
}

// Data access for expense/income transactions.
export const transactionRepository = {
  list(filters: TransactionFilters = {}) {
    return prisma.transaction.findMany({
      where: whereFromFilters(filters),
      include: { category: true, cashAccount: true },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      take: filters.limit,
      skip: filters.offset,
    });
  },

  recent(limit: number) {
    return prisma.transaction.findMany({
      include: { category: true },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      take: limit,
    });
  },

  create(data: Prisma.TransactionCreateInput) {
    return prisma.transaction.create({ data, include: { category: true } });
  },

  createMany(data: Prisma.TransactionCreateManyInput[]) {
    return prisma.transaction.createMany({ data });
  },

  /** Minimal fields needed to dedup an import against existing rows. */
  naturalKeys() {
    return prisma.transaction.findMany({
      select: { date: true, amount: true, direction: true, categoryId: true, note: true },
    });
  },

  update(id: string, data: Prisma.TransactionUpdateInput) {
    return prisma.transaction.update({ where: { id }, data, include: { category: true } });
  },

  delete(id: string) {
    return prisma.transaction.delete({ where: { id } });
  },

  /** Sum of amounts grouped by direction within an optional date range. */
  async sumByDirection(from?: Date, to?: Date): Promise<{ income: number; expense: number }> {
    const grouped = await prisma.transaction.groupBy({
      by: ["direction"],
      where: from || to ? { date: { gte: from ?? undefined, lte: to ?? undefined } } : undefined,
      _sum: { amount: true },
    });
    let income = 0;
    let expense = 0;
    for (const g of grouped) {
      const value = Number(g._sum.amount ?? 0);
      if (g.direction === "INCOME") income = value;
      else expense = value;
    }
    return { income, expense };
  },
};
