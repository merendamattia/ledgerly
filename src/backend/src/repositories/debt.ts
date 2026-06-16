import type { Prisma } from "@prisma/client";
import { prisma } from "../core/db.ts";

// Data access for liabilities (debts).
export const debtRepository = {
  list() {
    return prisma.debt.findMany({ orderBy: { createdAt: "asc" } });
  },

  findById(id: string) {
    return prisma.debt.findUnique({ where: { id } });
  },

  create(data: Prisma.DebtCreateInput) {
    return prisma.debt.create({ data });
  },

  update(id: string, data: Prisma.DebtUpdateInput) {
    return prisma.debt.update({ where: { id }, data });
  },

  delete(id: string) {
    return prisma.debt.delete({ where: { id } });
  },
};
