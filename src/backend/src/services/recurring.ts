import type { z } from "zod";
import type { updateRecurringSchema } from "../schemas/index.ts";
import type { Prisma, RecurInterval, RecurringExpense } from "@prisma/client";
import { recurringExpenseRepository } from "../repositories/recurringExpense.ts";
import { isRecurringEnded } from "../utils/recurring-status.ts";

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

type RecurInput = z.infer<typeof updateRecurringSchema>;

/** Ordinary edits preserve progress; rescheduling and resuming skip elapsed dates. */
function toData(input: RecurInput, existing: RecurringExpense, today: Date): Prisma.RecurringExpenseUpdateInput {
  const data: Prisma.RecurringExpenseUpdateInput = {};
  if (input.amount !== undefined) data.amount = input.amount;
  if (input.direction !== undefined) data.direction = input.direction;
  if (input.note !== undefined) data.note = input.note;
  if (input.intervalUnit !== undefined) data.intervalUnit = input.intervalUnit;
  if (input.intervalCount !== undefined) data.intervalCount = input.intervalCount;
  if (input.startDate !== undefined) data.startDate = input.startDate;
  if (input.endMode !== undefined) data.endMode = input.endMode;
  if (input.maxOccurrences !== undefined) data.maxOccurrences = input.maxOccurrences;
  if (input.endDate !== undefined) data.endDate = input.endDate;
  if (input.enabled !== undefined) data.enabled = input.enabled;
  if (input.categoryId !== undefined) {
    data.category = input.categoryId ? { connect: { id: input.categoryId } } : { disconnect: true };
  }
  const rule = { ...existing, ...input };
  const scheduleChanged = utcDay(rule.startDate).getTime() !== existing.startDate.getTime()
    || rule.intervalUnit !== existing.intervalUnit || rule.intervalCount !== existing.intervalCount;
  if (scheduleChanged || (input.enabled === true && !existing.enabled)) {
    // Never move behind the next unbooked date, even when changing the anchor.
    const floor = Math.max(utcDay(today).getTime(), existing.nextRunDate.getTime());
    let next = utcDay(scheduleChanged ? rule.startDate : existing.nextRunDate);
    while (next.getTime() < floor) {
      next = computeNextDate(next, rule.intervalUnit, rule.intervalCount);
    }
    data.nextRunDate = next;
    rule.nextRunDate = next;
  }
  if (isRecurringEnded(rule)) data.enabled = false;
  return data;
}

export function updateRecurring(userId: string, id: string, input: RecurInput, today = new Date()) {
  return recurringExpenseRepository.update(userId, id, (existing) => toData(input, existing, today));
}

/**
 * Book a Transaction for every due occurrence of every enabled rule, advancing
 * `nextRunDate`/`occurrencesCount` and disabling rules that reach their end
 * condition. Returns the number of movements created.
 */
export async function generateDue(userId: string, today: Date): Promise<number> {
  const cutoff = utcDay(today);
  const rules = await recurringExpenseRepository.listDue(userId, cutoff);
  let created = 0;

  for (const dueRule of rules) {
    created += await recurringExpenseRepository.bookDue(userId, dueRule.id, (rule) => {
      const dates: Date[] = [];
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

        dates.push(nextRunDate);
        occurrencesCount++;
        nextRunDate = computeNextDate(nextRunDate, rule.intervalUnit, rule.intervalCount);
      }

      const updated = { ...rule, occurrencesCount, nextRunDate };
      return { dates, occurrencesCount, nextRunDate, enabled: !isRecurringEnded(updated) };
    });
  }

  return created;
}
