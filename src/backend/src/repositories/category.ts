import type { CategoryKind, Prisma } from "@prisma/client";
import { prisma } from "../core/db.ts";

// Data access for expense/income categories.
export const categoryRepository = {
  list(kind?: CategoryKind) {
    return prisma.category.findMany({
      where: kind ? { kind } : undefined,
      orderBy: [{ kind: "asc" }, { name: "asc" }],
    });
  },

  findById(id: string) {
    return prisma.category.findUnique({ where: { id } });
  },

  findByNameKind(name: string, kind: CategoryKind) {
    return prisma.category.findFirst({ where: { name, kind } });
  },

  create(data: Prisma.CategoryCreateInput) {
    return prisma.category.create({ data });
  },

  update(id: string, data: Prisma.CategoryUpdateInput) {
    return prisma.category.update({ where: { id }, data });
  },

  delete(id: string) {
    return prisma.category.delete({ where: { id } });
  },

  /** Delete every category that has no transactions attached. */
  deleteUnused() {
    return prisma.category.deleteMany({ where: { transactions: { none: {} } } });
  },
};
