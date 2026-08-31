import type { CashCategory } from "@prisma/client";
import { snapshotRepository } from "../repositories/snapshot.ts";
import { cashSnapshotRepository } from "../repositories/cashSnapshot.ts";
import { cashAccountRepository } from "../repositories/cashAccount.ts";
import { debtSnapshotRepository } from "../repositories/debtSnapshot.ts";
import { debtRepository } from "../repositories/debt.ts";
import { computeNetWorth } from "./valuation.ts";
import { NotFoundError } from "../core/errors.ts";

/** Truncate a date to UTC midnight (matches the @db.Date column). */
function toUtcDate(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

/**
 * Snapshot every account's current balance and every debt's current amount for
 * `date` (idempotent per day). This is what builds the cash/debt history the
 * net-worth chart reads, so the nightly job records one point per day.
 */
export async function createDailyBalanceSnapshots(userId: string, date: Date = new Date()) {
  const day = toUtcDate(date);
  const [accounts, debts] = await Promise.all([
    cashAccountRepository.list(userId),
    debtRepository.list(userId),
  ]);
  await Promise.all([
    ...accounts.map((account) =>
      cashSnapshotRepository.upsertForAccountDate(
        userId,
        account.id,
        day,
        Number(account.balance),
        account.note,
      ),
    ),
    ...debts.map((debt) =>
      debtSnapshotRepository.upsertForDebtDate(userId, debt.id, day, Number(debt.amount), debt.note),
    ),
  ]);
}

/**
 * Compute and persist today's net worth snapshot. Idempotent per date: running
 * it again on the same day updates the existing row.
 */
export async function createDailySnapshot(userId: string, date: Date = new Date()) {
  const netWorth = await computeNetWorth(userId);
  const day = toUtcDate(date);
  return snapshotRepository.upsertForDate(userId, day, netWorth.total, {
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
  userId: string,
  date: Date,
  entries: { accountId: string; balance: number; note?: string | null }[],
) {
  const day = toUtcDate(date);
  const snapshots = [];
  for (const entry of entries) {
    const snap = await cashSnapshotRepository.upsertForAccountDate(
      userId,
      entry.accountId,
      day,
      entry.balance,
      entry.note,
    );
    if (!snap) throw new NotFoundError("Cash account not found");
    const account = await cashAccountRepository.update(userId, entry.accountId, {
      balance: entry.balance,
    });
    if (!account) throw new NotFoundError("Cash account not found");
    snapshots.push(snap);
  }
  return snapshots;
}

/**
 * Delete one cash snapshot and revert the account's cached `balance` to the most
 * recent remaining snapshot (or 0 if none are left). Returns the deleted row, or
 * null if the id doesn't exist.
 */
export async function deleteCashSnapshot(userId: string, id: string) {
  const snap = await cashSnapshotRepository.findById(userId, id);
  if (!snap) return null;
  await cashSnapshotRepository.deleteById(userId, id);
  const latest = await cashSnapshotRepository.latestForAccount(userId, snap.cashAccountId);
  await cashAccountRepository.update(userId, snap.cashAccountId, {
    balance: latest ? Number(latest.balance) : 0,
  });
  return snap;
}

/**
 * Delete every cash snapshot for accounts in `category`, then reset only those
 * accounts that actually had snapshots. After this operation they have no
 * remaining dated source of truth, so their cached balance becomes 0.
 */
export async function deleteCashSnapshotsByCategory(userId: string, category: CashCategory) {
  const accountIds = (await cashSnapshotRepository.accountIdsByCategory(userId, category)).map(
    (row) => row.cashAccountId,
  );
  if (accountIds.length === 0) return { deleted: 0 };
  const result = await cashSnapshotRepository.deleteByAccountCategory(userId, category);
  await cashAccountRepository.resetBalances(userId, accountIds);
  return { deleted: result.count };
}

/**
 * Record a dated amount snapshot for one or more debts. Each entry upserts the
 * debt's snapshot for `date` and refreshes its cached `amount`.
 */
export async function createDebtSnapshot(
  userId: string,
  date: Date,
  entries: { debtId: string; amount: number; note?: string | null }[],
) {
  const day = toUtcDate(date);
  const snapshots = [];
  for (const entry of entries) {
    const snap = await debtSnapshotRepository.upsertForDebtDate(
      userId,
      entry.debtId,
      day,
      entry.amount,
      entry.note,
    );
    if (!snap) throw new NotFoundError("Debt not found");
    const debt = await debtRepository.update(userId, entry.debtId, { amount: entry.amount });
    if (!debt) throw new NotFoundError("Debt not found");
    snapshots.push(snap);
  }
  return snapshots;
}

/**
 * Delete one debt snapshot and revert the debt's cached `amount` to the most
 * recent remaining snapshot (or 0 if none are left). Returns the deleted row, or
 * null if the id doesn't exist.
 */
export async function deleteDebtSnapshot(userId: string, id: string) {
  const snap = await debtSnapshotRepository.findById(userId, id);
  if (!snap) return null;
  await debtSnapshotRepository.deleteById(userId, id);
  const latest = await debtSnapshotRepository.latestForDebt(userId, snap.debtId);
  await debtRepository.update(userId, snap.debtId, {
    amount: latest ? Number(latest.amount) : 0,
  });
  return snap;
}

/**
 * Delete every debt snapshot and reset only debts that had at least one
 * snapshot. Once the history is gone, no dated amount remains to cache.
 */
export async function deleteAllDebtSnapshots(userId: string) {
  const debtIds = (await debtSnapshotRepository.debtIdsWithSnapshots(userId)).map((row) => row.debtId);
  if (debtIds.length === 0) return { deleted: 0 };
  const result = await debtSnapshotRepository.deleteAll(userId);
  await debtRepository.resetAmounts(userId, debtIds);
  return { deleted: result.count };
}
