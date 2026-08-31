import type { CashCategory, Prisma } from "@prisma/client";
import { prisma } from "../core/db.ts";

// Data access for cash accounts.
export const cashAccountRepository = {
  list(userId: string, category?: CashCategory) {
    return prisma.cashAccount.findMany({
      where: { userId, ...(category ? { category } : {}) },
      orderBy: { createdAt: "asc" },
    });
  },

  findById(userId: string, id: string) {
    return prisma.cashAccount.findFirst({ where: { id, userId } });
  },

  create(userId: string, data: Omit<Prisma.CashAccountCreateInput, "user">) {
    return prisma.cashAccount.create({ data: { ...data, user: { connect: { id: userId } } } });
  },

  async update(userId: string, id: string, data: Prisma.CashAccountUpdateInput) {
    if (!(await this.findById(userId, id))) return null;
    return prisma.cashAccount.update({ where: { id }, data });
  },

  resetBalances(userId: string, ids: string[]) {
    return prisma.cashAccount.updateMany({
      where: { id: { in: ids }, userId },
      data: { balance: 0 },
    });
  },

  async delete(userId: string, id: string) {
    if (!(await this.findById(userId, id))) return null;
    return prisma.cashAccount.delete({ where: { id } });
  },
};
