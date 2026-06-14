import type { Prisma } from "@prisma/client";
import { prisma } from "../core/db.ts";

// Data access for cash accounts.
export const cashAccountRepository = {
  list() {
    return prisma.cashAccount.findMany({ orderBy: { createdAt: "asc" } });
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

  delete(id: string) {
    return prisma.cashAccount.delete({ where: { id } });
  },
};
