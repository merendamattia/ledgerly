import { prisma } from "../core/db.ts";
import { NotFoundError } from "../core/errors.ts";

const withMembers = {
  members: { select: { cashAccountId: true, tickerId: true } },
} as const;

// Data access for the four investment pillars.
export const pillarRepository = {
  list(userId: string) {
    return prisma.pillar.findMany({
      where: { userId },
      orderBy: { position: "asc" },
      include: withMembers,
    });
  },

  async upsert(
    userId: string,
    position: number,
    data: { name: string; members: { cashAccountId?: string; tickerId?: string }[] },
  ) {
    await assertMembersOwned(userId, data.members);
    const members = { create: data.members };
    return prisma.pillar.upsert({
      where: { userId_position: { userId, position } },
      create: { user: { connect: { id: userId } }, position, name: data.name, members },
      update: { name: data.name, members: { deleteMany: {}, ...members } },
      include: withMembers,
    });
  },
};

async function assertMembersOwned(
  userId: string,
  members: { cashAccountId?: string; tickerId?: string }[],
): Promise<void> {
  const accountIds = [
    ...new Set(
      members.flatMap((member) => (member.cashAccountId ? [member.cashAccountId] : [])),
    ),
  ];
  const tickerIds = [
    ...new Set(members.flatMap((member) => (member.tickerId ? [member.tickerId] : []))),
  ];
  const [accountCount, tickerCount] = await Promise.all([
    prisma.cashAccount.count({ where: { id: { in: accountIds }, userId } }),
    prisma.ticker.count({ where: { id: { in: tickerIds }, userId } }),
  ]);
  if (accountCount !== accountIds.length || tickerCount !== tickerIds.length) {
    throw new NotFoundError("One or more pillar members were not found");
  }
}
