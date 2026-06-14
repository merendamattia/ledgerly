import { snapshotRepository } from "../repositories/snapshot.ts";
import { computeNetWorth } from "./valuation.ts";

/** Truncate a date to UTC midnight (matches the @db.Date column). */
function toUtcDate(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

/**
 * Compute and persist today's net worth snapshot. Idempotent per date: running
 * it again on the same day updates the existing row.
 */
export async function createDailySnapshot(date: Date = new Date()) {
  const netWorth = await computeNetWorth();
  const day = toUtcDate(date);
  return snapshotRepository.upsertForDate(day, netWorth.total, {
    cash: netWorth.cash,
    investments: netWorth.investments,
    allocation: netWorth.allocation,
  });
}
