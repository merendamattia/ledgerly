import { prisma } from "../core/db.ts";

// Data access for dated debt-amount snapshots.
export const debtSnapshotRepository = {
  /** Full snapshot history (with debt), oldest first. */
  history(userId: string) {
    return prisma.debtSnapshot.findMany({
      where: { debt: { userId } },
      include: { debt: true },
      orderBy: [{ date: "asc" }, { createdAt: "asc" }],
    });
  },

  /** The most recent snapshot on or before `date` for a debt. */
  latestForDebt(userId: string, debtId: string, date: Date = new Date()) {
    return prisma.debtSnapshot.findFirst({
      where: { debtId, debt: { userId }, date: { lte: date } },
      orderBy: { date: "desc" },
    });
  },

  upsertForDebtDate(
    userId: string,
    debtId: string,
    date: Date,
    amount: number,
    note?: string | null,
  ) {
    const notePatch = note === undefined ? {} : { note };
    return prisma.debt.findFirst({ where: { id: debtId, userId } }).then((debt) => {
      if (!debt) return null;
      return prisma.debtSnapshot.upsert({
        where: { debtId_date: { debtId, date } },
        create: { debtId, date, amount, ...notePatch },
        update: { amount, ...notePatch },
      });
    });
  },

  findById(userId: string, id: string) {
    return prisma.debtSnapshot.findFirst({ where: { id, debt: { userId } } });
  },

  async deleteById(userId: string, id: string) {
    if (!(await this.findById(userId, id))) return null;
    return prisma.debtSnapshot.delete({ where: { id } });
  },

  debtIdsWithSnapshots(userId: string) {
    return prisma.debtSnapshot.findMany({
      where: { debt: { userId } },
      distinct: ["debtId"],
      select: { debtId: true },
    });
  },

  deleteAll(userId: string) {
    return prisma.debtSnapshot.deleteMany({ where: { debt: { userId } } });
  },
};
