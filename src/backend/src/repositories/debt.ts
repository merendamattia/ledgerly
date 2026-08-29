import type { Prisma } from "@prisma/client";
import { prisma } from "../core/db.ts";

// Data access for liabilities (debts).
export const debtRepository = {
  list(userId: string) {
    return prisma.debt.findMany({ where: { userId }, orderBy: { createdAt: "asc" } });
  },

  findById(userId: string, id: string) {
    return prisma.debt.findFirst({ where: { id, userId } });
  },

  create(userId: string, data: Omit<Prisma.DebtCreateInput, "user">) {
    return prisma.debt.create({ data: { ...data, user: { connect: { id: userId } } } });
  },

  async update(userId: string, id: string, data: Prisma.DebtUpdateInput) {
    if (!(await this.findById(userId, id))) return null;
    return prisma.debt.update({ where: { id }, data });
  },

  resetAmounts(userId: string, ids: string[]) {
    return prisma.debt.updateMany({
      where: { id: { in: ids }, userId },
      data: { amount: 0 },
    });
  },

  async delete(userId: string, id: string) {
    if (!(await this.findById(userId, id))) return null;
    return prisma.debt.delete({ where: { id } });
  },
};
