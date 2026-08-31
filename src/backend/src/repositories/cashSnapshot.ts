import type { CashCategory } from "@prisma/client";
import { prisma } from "../core/db.ts";

// Data access for dated cash-account balance snapshots.
export const cashSnapshotRepository = {
  /** Full snapshot history (with account), oldest first. */
  history(userId: string) {
    return prisma.cashSnapshot.findMany({
      where: { cashAccount: { userId } },
      include: { cashAccount: true },
      orderBy: [{ date: "asc" }, { createdAt: "asc" }],
    });
  },

  /** The most recent snapshot on or before `date` for an account. */
  latestForAccount(userId: string, cashAccountId: string, date: Date = new Date()) {
    return prisma.cashSnapshot.findFirst({
      where: { cashAccountId, cashAccount: { userId }, date: { lte: date } },
      orderBy: { date: "desc" },
    });
  },

  upsertForAccountDate(
    userId: string,
    cashAccountId: string,
    date: Date,
    balance: number,
    note?: string | null,
  ) {
    const notePatch = note === undefined ? {} : { note };
    return prisma.cashAccount.findFirst({ where: { id: cashAccountId, userId } }).then((account) => {
      if (!account) return null;
      return prisma.cashSnapshot.upsert({
        where: { cashAccountId_date: { cashAccountId, date } },
        create: { cashAccountId, date, balance, ...notePatch },
        update: { balance, ...notePatch },
      });
    });
  },

  findById(userId: string, id: string) {
    return prisma.cashSnapshot.findFirst({ where: { id, cashAccount: { userId } } });
  },

  async deleteById(userId: string, id: string) {
    if (!(await this.findById(userId, id))) return null;
    return prisma.cashSnapshot.delete({ where: { id } });
  },

  accountIdsByCategory(userId: string, category: CashCategory) {
    return prisma.cashSnapshot.findMany({
      where: { cashAccount: { userId, category } },
      distinct: ["cashAccountId"],
      select: { cashAccountId: true },
    });
  },

  deleteByAccountCategory(userId: string, category: CashCategory) {
    return prisma.cashSnapshot.deleteMany({
      where: { cashAccount: { userId, category } },
    });
  },
};
