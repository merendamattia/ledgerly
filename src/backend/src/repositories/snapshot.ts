import type { Prisma } from "@prisma/client";
import { prisma } from "../core/db.ts";

// Data access for net worth snapshots.
export const snapshotRepository = {
  /** Snapshots ordered by date ascending, optionally limited to the most recent N. */
  async history(userId: string, limit?: number) {
    const rows = await prisma.netWorthSnapshot.findMany({
      where: { userId },
      orderBy: { date: "desc" },
      take: limit,
    });
    return rows.reverse();
  },

  latest(userId: string) {
    return prisma.netWorthSnapshot.findFirst({ where: { userId }, orderBy: { date: "desc" } });
  },

  upsertForDate(
    userId: string,
    date: Date,
    totalValue: number,
    breakdown: Prisma.InputJsonValue,
  ) {
    return prisma.netWorthSnapshot.upsert({
      where: { userId_date: { userId, date } },
      update: { totalValue, breakdown },
      create: { date, totalValue, breakdown, user: { connect: { id: userId } } },
    });
  },
};
