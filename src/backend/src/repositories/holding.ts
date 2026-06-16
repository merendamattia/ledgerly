import type { Prisma } from "@prisma/client";
import { prisma } from "../core/db.ts";

// Data access for investment holdings.
export const holdingRepository = {
  list() {
    return prisma.holding.findMany({
      include: { ticker: true, cashAccount: true },
      orderBy: { createdAt: "desc" },
    });
  },

  findById(id: string) {
    return prisma.holding.findUnique({ where: { id }, include: { ticker: true } });
  },

  create(data: Prisma.HoldingCreateInput) {
    return prisma.holding.create({ data, include: { ticker: true } });
  },

  update(id: string, data: Prisma.HoldingUpdateInput) {
    return prisma.holding.update({ where: { id }, data, include: { ticker: true } });
  },

  delete(id: string) {
    return prisma.holding.delete({ where: { id } });
  },

  countByTicker(tickerId: string) {
    return prisma.holding.count({ where: { tickerId } });
  },

  findByTicker(tickerId: string) {
    return prisma.holding.findFirst({ where: { tickerId } });
  },

  deleteByTicker(tickerId: string) {
    return prisma.holding.deleteMany({ where: { tickerId } });
  },
};
