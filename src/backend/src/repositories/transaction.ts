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
  list(userId: string, filters: TransactionFilters = {}) {
    return prisma.transaction.findMany({
      where: { userId, ...whereFromFilters(filters) },
      include: { category: true },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      take: filters.limit,
      skip: filters.offset,
    });
  },

  async summary(userId: string, filters: Omit<TransactionFilters, "limit" | "offset"> = {}) {
    const groups = await prisma.transaction.groupBy({
      where: { userId, ...whereFromFilters(filters) },
      by: ["direction"],
      _sum: { amount: true },
    });
    let income = 0;
    let expenses = 0;
    for (const group of groups) {
      const amount = Number(group._sum.amount ?? 0);
      if (group.direction === "INCOME") income = amount;
      else expenses = amount;
    }
    return { income, expenses, net: income - expenses };
  },

  recent(userId: string, limit: number) {
    return prisma.transaction.findMany({
      where: { userId },
      include: { category: true },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      take: limit,
    });
  },

  findById(userId: string, id: string) {
    return prisma.transaction.findFirst({ where: { id, userId }, include: { category: true } });
  },

  /** All transactions for one user in chronological order for analytics. */
  listAll(userId: string) {
    return prisma.transaction.findMany({
      where: { userId },
      include: { category: true },
      orderBy: [{ date: "asc" }, { createdAt: "asc" }],
    });
  },

  async create(userId: string, data: Omit<Prisma.TransactionCreateInput, "user">) {
    const transaction = await prisma.transaction.create({
      data: { ...data, user: { connect: { id: userId } } },
      include: { category: true },
    });
    await invalidateTransactionTagCache();
    return transaction;
  },

  async createMany(
    userId: string,
    data: Omit<Prisma.TransactionCreateManyInput, "userId">[],
  ) {
    const result = await prisma.transaction.createMany({
      data: data.map((row) => ({ ...row, userId })),
    });
    if (result.count > 0) await invalidateTransactionTagCache();
    return result;
  },

  /** Minimal fields needed to dedup an import against existing rows. */
  naturalKeys(userId: string, filters: Pick<TransactionFilters, "from" | "to"> = {}) {
    return prisma.transaction.findMany({
      where: { userId, ...whereFromFilters(filters) },
      select: { date: true, amount: true, direction: true, categoryId: true, note: true },
    });
  },

  /** Notes that may contain tags, newest first, for the lightweight tag endpoint. */
  tagNotes(
    userId: string,
    filters: Pick<TransactionFilters, "from" | "to" | "categoryId" | "direction"> = {},
  ) {
    return prisma.transaction.findMany({
      where: { userId, ...whereFromFilters(filters), note: { contains: "#" } },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      select: { note: true },
    });
  },

  async update(userId: string, id: string, data: Prisma.TransactionUpdateInput) {
    const existing = await prisma.transaction.findFirst({
      where: { id, userId },
      select: { reviewRequired: true },
    });
    if (!existing) return null;
    const transaction = await prisma.transaction.update({
      where: { id },
      data: {
        ...data,
        ...(existing.reviewRequired
          ? { reviewRequired: false, reviewedAt: new Date() }
          : {}),
      },
      include: { category: true },
    });
    await invalidateTransactionTagCache();
    return transaction;
  },

  async markReviewed(userId: string, id: string) {
    const existing = await prisma.transaction.findFirst({
      where: { id, userId },
      select: { reviewRequired: true },
    });
    if (!existing) return null;
    if (!existing.reviewRequired) {
      return prisma.transaction.findUnique({ where: { id }, include: { category: true } });
    }
    const transaction = await prisma.transaction.update({
      where: { id },
      data: { reviewRequired: false, reviewedAt: new Date() },
      include: { category: true },
    });
    await invalidateTransactionTagCache();
    return transaction;
  },

  async delete(userId: string, id: string) {
    if (!(await prisma.transaction.findFirst({ where: { id, userId } }))) return null;
    const transaction = await prisma.transaction.delete({ where: { id } });
    await invalidateTransactionTagCache();
    return transaction;
  },

};
