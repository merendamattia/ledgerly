import { prisma } from "../core/db.ts";
import { NotFoundError } from "../core/errors.ts";

const withMembers = { members: { select: { tickerId: true } } } as const;

// Data access for rebalance groups (target-allocation rows).
export const rebalanceRepository = {
  list(userId: string) {
    return prisma.rebalanceGroup.findMany({
      where: { userId },
      orderBy: { createdAt: "asc" },
      include: withMembers,
    });
  },

  findById(userId: string, id: string) {
    return prisma.rebalanceGroup.findFirst({ where: { id, userId }, include: withMembers });
  },

  async create(
    userId: string,
    data: { name: string; targetPct: number; thresholdPct: number; tickerIds: string[] },
  ) {
    await assertTickersOwned(userId, data.tickerIds);
    return prisma.rebalanceGroup.create({
      data: {
        name: data.name,
        targetPct: data.targetPct,
        thresholdPct: data.thresholdPct,
        user: { connect: { id: userId } },
        members: { create: data.tickerIds.map((tickerId) => ({ tickerId })) },
      },
      include: withMembers,
    });
  },

  async update(
    userId: string,
    id: string,
    data: { name?: string; targetPct?: number; thresholdPct?: number; tickerIds?: string[] },
  ) {
    const { tickerIds, ...fields } = data;
    if (tickerIds) await assertTickersOwned(userId, tickerIds);
    if (!(await this.findById(userId, id))) return null;
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

  async delete(userId: string, id: string) {
    if (!(await this.findById(userId, id))) return null;
    return prisma.rebalanceGroup.delete({ where: { id } });
  },
};

async function assertTickersOwned(userId: string, tickerIds: string[]): Promise<void> {
  const uniqueIds = [...new Set(tickerIds)];
  const count = await prisma.ticker.count({ where: { id: { in: uniqueIds }, userId } });
  if (count !== uniqueIds.length) throw new NotFoundError("One or more assets were not found");
}
