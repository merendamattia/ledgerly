import type { Prisma } from "@prisma/client";
import { prisma } from "../core/db.ts";

// Data access for investment holdings.
export const holdingRepository = {
  list(userId: string) {
    return prisma.holding.findMany({
      where: { userId },
      include: { ticker: true, cashAccount: true },
      orderBy: { createdAt: "desc" },
    });
  },

  findById(userId: string, id: string) {
    return prisma.holding.findFirst({ where: { id, userId }, include: { ticker: true } });
  },

  create(userId: string, data: Omit<Prisma.HoldingCreateInput, "user">) {
    return prisma.holding.create({
      data: { ...data, user: { connect: { id: userId } } },
      include: { ticker: true },
    });
  },

  async update(userId: string, id: string, data: Prisma.HoldingUpdateInput) {
    if (!(await this.findById(userId, id))) return null;
    return prisma.holding.update({ where: { id }, data, include: { ticker: true } });
  },

  async delete(userId: string, id: string) {
    if (!(await this.findById(userId, id))) return null;
    return prisma.holding.delete({ where: { id } });
  },

  countByTicker(userId: string, tickerId: string) {
    return prisma.holding.count({ where: { userId, tickerId } });
  },

  findByTicker(userId: string, tickerId: string) {
    return prisma.holding.findFirst({ where: { userId, tickerId } });
  },

  deleteByTicker(userId: string, tickerId: string) {
    return prisma.holding.deleteMany({ where: { userId, tickerId } });
  },
};
