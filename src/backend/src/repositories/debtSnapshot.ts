import { prisma } from "../core/db.ts";

// Data access for dated debt-amount snapshots.
export const debtSnapshotRepository = {
  /** Full snapshot history (with debt), oldest first. */
  history() {
    return prisma.debtSnapshot.findMany({
      include: { debt: true },
      orderBy: [{ date: "asc" }, { createdAt: "asc" }],
    });
  },

  /** The most recent snapshot on or before `date` for a debt. */
  latestForDebt(debtId: string, date: Date = new Date()) {
    return prisma.debtSnapshot.findFirst({
      where: { debtId, date: { lte: date } },
      orderBy: { date: "desc" },
    });
  },

  upsertForDebtDate(debtId: string, date: Date, amount: number) {
    return prisma.debtSnapshot.upsert({
      where: { debtId_date: { debtId, date } },
      create: { debtId, date, amount },
      update: { amount },
    });
  },

  findById(id: string) {
    return prisma.debtSnapshot.findUnique({ where: { id } });
  },

  deleteById(id: string) {
    return prisma.debtSnapshot.delete({ where: { id } });
  },

  debtIdsWithSnapshots() {
    return prisma.debtSnapshot.findMany({
      distinct: ["debtId"],
      select: { debtId: true },
    });
  },

  deleteAll() {
    return prisma.debtSnapshot.deleteMany();
  },
};
