import type { Prisma } from "@prisma/client";
import { prisma } from "../core/db.ts";
import { filterUnfinishedRecurringRules } from "../utils/recurring-status.ts";

// Data access for recurring expense/income rules.
export const recurringExpenseRepository = {
  /** Lists unfinished rules, including those paused manually. */
  async list(userId: string) {
    const rules = await prisma.recurringExpense.findMany({
      where: { userId },
      include: { category: true },
      orderBy: [{ enabled: "desc" }, { nextRunDate: "asc" }],
    });
    return filterUnfinishedRecurringRules(rules);
  },

  findById(userId: string, id: string) {
    return prisma.recurringExpense.findFirst({
      where: { id, userId },
      include: { category: true },
    });
  },

  create(userId: string, data: Omit<Prisma.RecurringExpenseCreateInput, "user">) {
    return prisma.recurringExpense.create({
      data: { ...data, user: { connect: { id: userId } } },
      include: { category: true },
    });
  },

  async update(userId: string, id: string, data: Prisma.RecurringExpenseUpdateInput) {
    if (!(await this.findById(userId, id))) return null;
    return prisma.recurringExpense.update({
      where: { id },
      data,
      include: { category: true },
    });
  },

  async delete(userId: string, id: string) {
    if (!(await this.findById(userId, id))) return null;
    return prisma.recurringExpense.delete({ where: { id } });
  },

  /** Enabled rules whose next occurrence is due on or before `date`. */
  listDue(userId: string, onOrBefore: Date) {
    return prisma.recurringExpense.findMany({
      where: { userId, enabled: true, nextRunDate: { lte: onOrBefore } },
    });
  },

  updateProgress(userId: string, id: string, occurrencesCount: number, nextRunDate: Date, enabled: boolean) {
    return prisma.recurringExpense.updateMany({
      where: { id, userId },
      data: { occurrencesCount, nextRunDate, enabled },
    });
  },
};
