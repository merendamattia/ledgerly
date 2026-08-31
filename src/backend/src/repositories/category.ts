import type { CategoryKind, Prisma } from "@prisma/client";
import { prisma } from "../core/db.ts";

// Data access for expense/income categories.
export const categoryRepository = {
  list(userId: string, kind?: CategoryKind) {
    return prisma.category.findMany({
      where: { userId, ...(kind ? { kind } : {}) },
      orderBy: [{ kind: "asc" }, { name: "asc" }],
    });
  },

  findById(userId: string, id: string) {
    return prisma.category.findFirst({ where: { id, userId } });
  },

  findByNameKind(userId: string, name: string, kind: CategoryKind) {
    return prisma.category.findFirst({ where: { userId, name, kind } });
  },

  create(userId: string, data: Omit<Prisma.CategoryCreateInput, "user">) {
    return prisma.category.create({ data: { ...data, user: { connect: { id: userId } } } });
  },

  async update(userId: string, id: string, data: Prisma.CategoryUpdateInput) {
    if (!(await this.findById(userId, id))) return null;
    return prisma.category.update({ where: { id }, data });
  },

  async delete(userId: string, id: string) {
    if (!(await this.findById(userId, id))) return null;
    return prisma.category.delete({ where: { id } });
  },

  /** Delete every category that has no transactions attached. */
  deleteUnused(userId: string) {
    return prisma.category.deleteMany({ where: { userId, transactions: { none: {} } } });
  },
};
