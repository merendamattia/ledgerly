import type { CashCategory, Prisma } from "@prisma/client";
import { prisma } from "../core/db.ts";

// Data access for cash accounts.
export const cashAccountRepository = {
  list(category?: CashCategory) {
    return prisma.cashAccount.findMany({
      where: category ? { category } : undefined,
      orderBy: { createdAt: "asc" },
    });
  },

  findById(id: string) {
    return prisma.cashAccount.findUnique({ where: { id } });
  },

  create(data: Prisma.CashAccountCreateInput) {
    return prisma.cashAccount.create({ data });
  },

  update(id: string, data: Prisma.CashAccountUpdateInput) {
    return prisma.cashAccount.update({ where: { id }, data });
  },

  resetBalances(ids: string[]) {
    return prisma.cashAccount.updateMany({
      where: { id: { in: ids } },
      data: { balance: 0 },
    });
  },

  delete(id: string) {
    return prisma.cashAccount.delete({ where: { id } });
  },
};
