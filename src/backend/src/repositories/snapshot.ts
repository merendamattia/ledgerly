import type { Prisma } from "@prisma/client";
import { prisma } from "../core/db.ts";

// Data access for net worth snapshots.
export const snapshotRepository = {
  /** Snapshots ordered by date ascending, optionally limited to the most recent N. */
  async history(limit?: number) {
    const rows = await prisma.netWorthSnapshot.findMany({
      orderBy: { date: "desc" },
      take: limit,
    });
    return rows.reverse();
  },

  latest() {
    return prisma.netWorthSnapshot.findFirst({ orderBy: { date: "desc" } });
  },

  upsertForDate(date: Date, totalValue: number, breakdown: Prisma.InputJsonValue) {
    return prisma.netWorthSnapshot.upsert({
      where: { date },
      update: { totalValue, breakdown },
      create: { date, totalValue, breakdown },
    });
  },
};
