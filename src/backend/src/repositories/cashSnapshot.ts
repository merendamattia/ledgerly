import { prisma } from "../core/db.ts";

// Data access for dated cash-account balance snapshots.
export const cashSnapshotRepository = {
  /** Full snapshot history (with account), oldest first. */
  history() {
    return prisma.cashSnapshot.findMany({
      include: { cashAccount: true },
      orderBy: [{ date: "asc" }, { createdAt: "asc" }],
    });
  },

  /** The most recent snapshot on or before `date` for an account. */
  latestForAccount(cashAccountId: string, date: Date = new Date()) {
    return prisma.cashSnapshot.findFirst({
      where: { cashAccountId, date: { lte: date } },
      orderBy: { date: "desc" },
    });
  },

  upsertForAccountDate(cashAccountId: string, date: Date, balance: number) {
    return prisma.cashSnapshot.upsert({
      where: { cashAccountId_date: { cashAccountId, date } },
      create: { cashAccountId, date, balance },
      update: { balance },
    });
  },
};
