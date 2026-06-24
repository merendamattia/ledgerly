import type { Prisma } from "@prisma/client";
import { prisma } from "../core/db.ts";

// Data access for recurring expense/income rules.
export const recurringExpenseRepository = {
  list() {
    return prisma.recurringExpense.findMany({
      include: { category: true },
      orderBy: [{ enabled: "desc" }, { nextRunDate: "asc" }],
    });
  },

  findById(id: string) {
    return prisma.recurringExpense.findUnique({
      where: { id },
      include: { category: true },
    });
  },

  create(data: Prisma.RecurringExpenseCreateInput) {
    return prisma.recurringExpense.create({ data, include: { category: true } });
  },

  update(id: string, data: Prisma.RecurringExpenseUpdateInput) {
    return prisma.recurringExpense.update({
      where: { id },
      data,
      include: { category: true },
    });
  },

  delete(id: string) {
    return prisma.recurringExpense.delete({ where: { id } });
  },

  /** Enabled rules whose next occurrence is due on or before `date`. */
  listDue(onOrBefore: Date) {
    return prisma.recurringExpense.findMany({
      where: { enabled: true, nextRunDate: { lte: onOrBefore } },
    });
  },
};
