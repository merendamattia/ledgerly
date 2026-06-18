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
    credits: netWorth.credits,
    otherAssets: netWorth.otherAssets,
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
 * Delete one cash snapshot and revert the account's cached `balance` to the most
 * recent remaining snapshot (or 0 if none are left). Returns the deleted row, or
 * null if the id doesn't exist.
 */
export async function deleteCashSnapshot(id: string) {
  const snap = await cashSnapshotRepository.findById(id);
  if (!snap) return null;
  await cashSnapshotRepository.deleteById(id);
  const latest = await cashSnapshotRepository.latestForAccount(snap.cashAccountId);
  await cashAccountRepository.update(snap.cashAccountId, {
    balance: latest ? Number(latest.balance) : 0,
  });
  return snap;
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

/**
 * Delete one debt snapshot and revert the debt's cached `amount` to the most
 * recent remaining snapshot (or 0 if none are left). Returns the deleted row, or
 * null if the id doesn't exist.
 */
export async function deleteDebtSnapshot(id: string) {
  const snap = await debtSnapshotRepository.findById(id);
  if (!snap) return null;
  await debtSnapshotRepository.deleteById(id);
  const latest = await debtSnapshotRepository.latestForDebt(snap.debtId);
  await debtRepository.update(snap.debtId, {
    amount: latest ? Number(latest.amount) : 0,
  });
  return snap;
}
