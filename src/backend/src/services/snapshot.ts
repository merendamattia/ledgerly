import { snapshotRepository } from "../repositories/snapshot.ts";
import { cashSnapshotRepository } from "../repositories/cashSnapshot.ts";
import { cashAccountRepository } from "../repositories/cashAccount.ts";
import { debtSnapshotRepository } from "../repositories/debtSnapshot.ts";
import { debtRepository } from "../repositories/debt.ts";
import { computeNetWorth } from "./valuation.ts";

/** Truncate a date to UTC midnight (matches the @db.Date column). */
function toUtcDate(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

/**
 * Snapshot every account's current balance and every debt's current amount for
 * `date` (idempotent per day). This is what builds the cash/debt history the
 * net-worth chart reads, so the nightly job records one point per day.
 */
export async function createDailyBalanceSnapshots(date: Date = new Date()) {
  const day = toUtcDate(date);
  const accounts = await cashAccountRepository.list();
  for (const account of accounts) {
    await cashSnapshotRepository.upsertForAccountDate(account.id, day, Number(account.balance));
  }
  const debts = await debtRepository.list();
  for (const debt of debts) {
    await debtSnapshotRepository.upsertForDebtDate(debt.id, day, Number(debt.amount));
  }
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
    debts: netWorth.debts,
    allocation: netWorth.allocation,
  });
}

/**
 * Record a dated balance snapshot for one or more cash accounts. Each entry
 * upserts the account's snapshot for `date` and refreshes its cached `balance`.
 */
export async function createCashSnapshot(
  date: Date,
  entries: { accountId: string; balance: number }[],
) {
  const day = toUtcDate(date);
  const snapshots = [];
  for (const entry of entries) {
    const snap = await cashSnapshotRepository.upsertForAccountDate(
      entry.accountId,
      day,
      entry.balance,
    );
    await cashAccountRepository.update(entry.accountId, { balance: entry.balance });
    snapshots.push(snap);
  }
  return snapshots;
}

/**
 * Record a dated amount snapshot for one or more debts. Each entry upserts the
 * debt's snapshot for `date` and refreshes its cached `amount`.
 */
export async function createDebtSnapshot(
  date: Date,
  entries: { debtId: string; amount: number }[],
) {
  const day = toUtcDate(date);
  const snapshots = [];
  for (const entry of entries) {
    const snap = await debtSnapshotRepository.upsertForDebtDate(entry.debtId, day, entry.amount);
    await debtRepository.update(entry.debtId, { amount: entry.amount });
    snapshots.push(snap);
  }
  return snapshots;
}
