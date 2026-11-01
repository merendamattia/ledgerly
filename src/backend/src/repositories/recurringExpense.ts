import type { Prisma, RecurringExpense } from "@prisma/client";
import { prisma } from "../core/db.ts";
import { invalidateTransactionTagCache } from "../services/transactionTagCache.ts";
import { filterUnfinishedRecurringRules } from "../utils/recurring-status.ts";

export type RecurringBooking = {
  dates: Date[];
  occurrencesCount: number;
  nextRunDate: Date;
  enabled: boolean;
};

/** Serialize edits and bookings across processes; always read after acquiring the lock. */
async function withLockedRule<T>(
  userId: string,
  id: string,
  operation: (tx: Prisma.TransactionClient, rule: RecurringExpense) => Promise<T>,
): Promise<T | null> {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM recurring_expense WHERE id = ${id} AND "userId" = ${userId} FOR UPDATE`;
    const rule = await tx.recurringExpense.findFirst({ where: { id, userId } });
    return rule ? operation(tx, rule) : null;
  });
}

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

  update(
    userId: string,
    id: string,
    data: (rule: RecurringExpense) => Prisma.RecurringExpenseUpdateInput,
  ) {
    return withLockedRule(userId, id, (tx, rule) => tx.recurringExpense.update({
      where: { id },
      data: data(rule),
      include: { category: true },
    }));
  },

  async delete(userId: string, id: string) {
    if (!(await this.findById(userId, id))) return null;
    return prisma.recurringExpense.delete({ where: { id } });
  },

  /** Enabled rules whose next occurrence is due on or before `date`. */
  listDue(userId: string, onOrBefore: Date) {
    return prisma.recurringExpense.findMany({
      where: { userId, enabled: true, nextRunDate: { lte: onOrBefore } },
      select: { id: true },
    });
  },

  /** Commit movements and their cursor together, or roll back both on any failure. */
  async bookDue(userId: string, id: string, plan: (rule: RecurringExpense) => RecurringBooking) {
    const created = await withLockedRule(userId, id, async (tx, rule) => {
      if (!rule.enabled) return 0;
      const { dates, ...progress } = plan(rule);
      if (dates.length > 0) {
        await tx.transaction.createMany({ data: dates.map((date) => ({
          userId, date, amount: rule.amount, direction: rule.direction,
          note: rule.note, categoryId: rule.categoryId, recurringExpenseId: id,
        })) });
      }
      await tx.recurringExpense.update({ where: { id }, data: progress });
      return dates.length;
    });
    if (created) await invalidateTransactionTagCache();
    return created ?? 0;
  },
};
