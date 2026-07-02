import { prisma } from "../core/db.ts";

const withMembers = {
  members: { select: { cashAccountId: true, tickerId: true } },
} as const;

// Data access for the four investment pillars.
export const pillarRepository = {
  list() {
    return prisma.pillar.findMany({ orderBy: { position: "asc" }, include: withMembers });
  },

  upsert(
    position: number,
    data: { name: string; members: { cashAccountId?: string; tickerId?: string }[] },
  ) {
    const members = { create: data.members };
    return prisma.pillar.upsert({
      where: { position },
      create: { position, name: data.name, members },
      update: { name: data.name, members: { deleteMany: {}, ...members } },
      include: withMembers,
    });
  },
};
