import type { RecurInterval, RecurringExpense } from "@prisma/client";
import { prisma } from "../core/db.ts";
import { recurringExpenseRepository } from "../repositories/recurringExpense.ts";
import { transactionRepository } from "../repositories/transaction.ts";

// Safety cap on how many movements a single rule can generate in one run, to
// guard against a misconfigured rule (e.g. very old start date) flooding the DB.
const MAX_ITERATIONS = 400;

/** Midnight-UTC copy of a date (the schema stores dates as @db.Date). */
function utcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

/**
 * Advance a date by `count` units. MONTH preserves the day-of-month, clamping to
 * the last valid day (e.g. Jan 31 + 1 month → Feb 28/29).
 */
export function computeNextDate(date: Date, unit: RecurInterval, count: number): Date {
  const d = utcDay(date);
  if (unit === "DAY") {
    d.setUTCDate(d.getUTCDate() + count);
    return d;
  }
  if (unit === "WEEK") {
    d.setUTCDate(d.getUTCDate() + count * 7);
    return d;
  }
  // MONTH
  const day = d.getUTCDate();
  const target = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + count, 1));
  const lastDay = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0),
  ).getUTCDate();
  target.setUTCDate(Math.min(day, lastDay));
  return target;
}

type OccurrenceRule = Pick<
  RecurringExpense,
  "startDate" | "intervalUnit" | "intervalCount" | "endMode" | "maxOccurrences" | "endDate"
>;

/**
 * The booking dates a rule produces from `startDate`, honoring the end condition.
 * Bounded by `limit` (always, so NEVER rules terminate). Mirrored on the client
 * for the form preview and the Cash Flow upcoming list.
 */
export function occurrenceDates(rule: OccurrenceRule, limit: number): Date[] {
  const dates: Date[] = [];
  let current = utcDay(rule.startDate);
  const end = rule.endDate ? utcDay(rule.endDate) : null;

  for (let i = 0; i < limit && i < MAX_ITERATIONS; i++) {
    if (rule.endMode === "AFTER_OCCURRENCES" && rule.maxOccurrences != null && i >= rule.maxOccurrences)
      break;
    if (rule.endMode === "ON_DATE" && end && current.getTime() > end.getTime()) break;
    dates.push(current);
    current = computeNextDate(current, rule.intervalUnit, rule.intervalCount);
  }
  return dates;
}

/** Whether a rule has produced its final occurrence and should be disabled. */
function isExhausted(rule: RecurringExpense): boolean {
  if (rule.endMode === "AFTER_OCCURRENCES" && rule.maxOccurrences != null) {
    return rule.occurrencesCount >= rule.maxOccurrences;
  }
  if (rule.endMode === "ON_DATE" && rule.endDate) {
    return utcDay(rule.nextRunDate).getTime() > utcDay(rule.endDate).getTime();
  }
  return false;
}

/**
 * Book a Transaction for every due occurrence of every enabled rule, advancing
 * `nextRunDate`/`occurrencesCount` and disabling rules that reach their end
 * condition. Returns the number of movements created.
 */
export async function generateDue(today: Date): Promise<number> {
  const cutoff = utcDay(today);
  const rules = await recurringExpenseRepository.listDue(cutoff);
  let created = 0;

  for (const rule of rules) {
    let occurrencesCount = rule.occurrencesCount;
    let nextRunDate = utcDay(rule.nextRunDate);
    const endDate = rule.endDate ? utcDay(rule.endDate) : null;

    for (let i = 0; i < MAX_ITERATIONS; i++) {
      if (nextRunDate.getTime() > cutoff.getTime()) break;
      if (rule.endMode === "ON_DATE" && endDate && nextRunDate.getTime() > endDate.getTime()) break;
      if (
        rule.endMode === "AFTER_OCCURRENCES" &&
        rule.maxOccurrences != null &&
        occurrencesCount >= rule.maxOccurrences
      )
        break;

      await transactionRepository.create({
        date: nextRunDate,
        amount: rule.amount,
        direction: rule.direction,
        note: rule.note,
        category: rule.categoryId ? { connect: { id: rule.categoryId } } : undefined,
        recurringExpense: { connect: { id: rule.id } },
      });
      created++;
      occurrencesCount++;
      nextRunDate = computeNextDate(nextRunDate, rule.intervalUnit, rule.intervalCount);
    }

    const updated = { ...rule, occurrencesCount, nextRunDate };
    await prisma.recurringExpense.update({
      where: { id: rule.id },
      data: {
        occurrencesCount,
        nextRunDate,
        enabled: isExhausted(updated) ? false : rule.enabled,
      },
    });
  }

  return created;
}
