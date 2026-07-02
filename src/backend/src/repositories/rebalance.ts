import { prisma } from "../core/db.ts";

const withMembers = { members: { select: { tickerId: true } } } as const;

// Data access for rebalance groups (target-allocation rows).
export const rebalanceRepository = {
  list() {
    return prisma.rebalanceGroup.findMany({
      orderBy: { createdAt: "asc" },
      include: withMembers,
    });
  },

  findById(id: string) {
    return prisma.rebalanceGroup.findUnique({ where: { id }, include: withMembers });
  },

  create(data: { name: string; targetPct: number; thresholdPct: number; tickerIds: string[] }) {
    return prisma.rebalanceGroup.create({
      data: {
        name: data.name,
        targetPct: data.targetPct,
        thresholdPct: data.thresholdPct,
        members: { create: data.tickerIds.map((tickerId) => ({ tickerId })) },
      },
      include: withMembers,
    });
  },

  update(
    id: string,
    data: { name?: string; targetPct?: number; thresholdPct?: number; tickerIds?: string[] },
  ) {
    const { tickerIds, ...fields } = data;
    return prisma.rebalanceGroup.update({
      where: { id },
      data: {
        ...fields,
        ...(tickerIds
          ? { members: { deleteMany: {}, create: tickerIds.map((tickerId) => ({ tickerId })) } }
          : {}),
      },
      include: withMembers,
    });
  },

  delete(id: string) {
    return prisma.rebalanceGroup.delete({ where: { id } });
  },
};
