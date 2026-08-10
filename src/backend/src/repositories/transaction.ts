import type { Prisma, TxDirection } from "@prisma/client";
import { prisma } from "../core/db.ts";
import { invalidateTransactionTagCache } from "../services/transactionTagCache.ts";

export interface TransactionFilters {
  search?: string;
  from?: Date;
  to?: Date;
  categoryId?: string;
  direction?: TxDirection;
  limit?: number;
  offset?: number;
}

/**
 * Converts transaction list filters into a Prisma where clause.
 */
function whereFromFilters(f: TransactionFilters): Prisma.TransactionWhereInput {
  const search = f.search?.trim();

  return {
    ...(search
      ? {
          OR: [
            { note: { contains: search, mode: "insensitive" } },
            { category: { name: { contains: search, mode: "insensitive" } } },
          ],
        }
      : {}),
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
      include: { category: true },
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

  async create(data: Prisma.TransactionCreateInput) {
    const transaction = await prisma.transaction.create({ data, include: { category: true } });
    await invalidateTransactionTagCache();
    return transaction;
  },

  async createMany(data: Prisma.TransactionCreateManyInput[]) {
    const result = await prisma.transaction.createMany({ data });
    if (result.count > 0) await invalidateTransactionTagCache();
    return result;
  },

  /** Minimal fields needed to dedup an import against existing rows. */
  naturalKeys(filters: Pick<TransactionFilters, "from" | "to"> = {}) {
    return prisma.transaction.findMany({
      where: whereFromFilters(filters),
      select: { date: true, amount: true, direction: true, categoryId: true, note: true },
    });
  },

  /** Notes that may contain tags, newest first, for the lightweight tag endpoint. */
  tagNotes(filters: Pick<TransactionFilters, "from" | "to" | "categoryId" | "direction"> = {}) {
    return prisma.transaction.findMany({
      where: { ...whereFromFilters(filters), note: { contains: "#" } },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      select: { note: true },
    });
  },

  async update(id: string, data: Prisma.TransactionUpdateInput) {
    const transaction = await prisma.transaction.update({
      where: { id },
      data,
      include: { category: true },
    });
    await invalidateTransactionTagCache();
    return transaction;
  },

  async delete(id: string) {
    const transaction = await prisma.transaction.delete({ where: { id } });
    await invalidateTransactionTagCache();
    return transaction;
  },

};
