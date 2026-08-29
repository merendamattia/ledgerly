import { settingsRepository } from "../repositories/settings.ts";
import { cashSnapshotRepository } from "../repositories/cashSnapshot.ts";
import { cashAccountRepository } from "../repositories/cashAccount.ts";
import { debtSnapshotRepository } from "../repositories/debtSnapshot.ts";
import { debtRepository } from "../repositories/debt.ts";
import { getFxRate } from "./market/fx.ts";
import { computeInvestmentHistory } from "./investmentHistory.ts";

export interface NetWorthPoint {
  date: string; // yyyy-mm-dd
  cash: number;
  credits: number;
  otherAssets: number;
  investments: number;
  debts: number;
  totalValue: number;
}

/**
 * Formats a Date as the yyyy-mm-dd key used by net-worth history points.
 */
function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Daily net-worth series in base currency, from the earliest recorded event to
 * today. Investments come from price history; cash and debts are step functions
 * driven by their dated snapshots (a value applies from its snapshot day onward).
 */
export async function computeNetWorthHistory(userId: string): Promise<NetWorthPoint[]> {
  const [baseCurrency, inv, cashSnaps, debtSnaps, accounts, debtsRows] = await Promise.all([
    settingsRepository.baseCurrency(userId),
    computeInvestmentHistory(userId),
    cashSnapshotRepository.history(userId),
    debtSnapshotRepository.history(userId),
    cashAccountRepository.list(userId),
    debtRepository.list(userId),
  ]);
  const invByDate = new Map(inv.map((p) => [p.date, p.value]));
  const accountsById = new Map(accounts.map((a) => [a.id, a]));

  const currencies = new Set<string>();
  for (const snapshot of cashSnaps) currencies.add(snapshot.cashAccount.currency);
  for (const account of accounts) currencies.add(account.currency);
  for (const snapshot of debtSnaps) currencies.add(snapshot.debt.currency);
  for (const debt of debtsRows) currencies.add(debt.currency);
  const fxByCurrency = new Map<string, number>(
    await Promise.all(
      [...currencies].map(async (currency) => [
        currency,
        await getFxRate(currency, baseCurrency),
      ] as const),
    ),
  );
  const fx = (cur: string) => fxByCurrency.get(cur) ?? 1;

  /**
   * Converts a Date to a UTC-midnight timestamp for step-function comparisons.
   */
  function dayMsOf(d: Date): number {
    return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  }

  // Per-account / per-debt ascending step series (already in base currency).
  // Steps come from dated snapshots plus a final step at the row's current value
  // (from its updatedAt day) so the live balance flows into the latest points.
  const cashByAccount = new Map<string, { date: number; value: number }[]>();
  for (const s of cashSnaps) {
    const arr = cashByAccount.get(s.cashAccountId) ?? [];
    arr.push({ date: dayMsOf(s.date), value: Number(s.balance) * fx(s.cashAccount.currency) });
    cashByAccount.set(s.cashAccountId, arr);
  }
  for (const a of accounts) {
    const arr = cashByAccount.get(a.id) ?? [];
    arr.push({ date: dayMsOf(a.updatedAt), value: Number(a.balance) * fx(a.currency) });
    arr.sort((x, y) => x.date - y.date);
    cashByAccount.set(a.id, arr);
  }
  const debtById = new Map<string, { date: number; value: number }[]>();
  for (const s of debtSnaps) {
    const arr = debtById.get(s.debtId) ?? [];
    arr.push({ date: dayMsOf(s.date), value: Number(s.amount) * fx(s.debt.currency) });
    debtById.set(s.debtId, arr);
  }
  for (const d of debtsRows) {
    const arr = debtById.get(d.id) ?? [];
    arr.push({ date: dayMsOf(d.updatedAt), value: Number(d.amount) * fx(d.currency) });
    arr.sort((x, y) => x.date - y.date);
    debtById.set(d.id, arr);
  }

  const starts: number[] = [];
  if (inv.length) starts.push(new Date(inv[0].date).getTime());
  for (const arr of cashByAccount.values()) if (arr.length) starts.push(arr[0].date);
  for (const arr of debtById.values()) if (arr.length) starts.push(arr[0].date);
  if (starts.length === 0) return [];
  const startMs = Math.min(...starts);

  const ptr = new Map<string, number>();
  for (const id of cashByAccount.keys()) ptr.set(`c:${id}`, -1);
  for (const id of debtById.keys()) ptr.set(`d:${id}`, -1);

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const start = new Date(startMs);
  const day = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()));

  const points: NetWorthPoint[] = [];
  for (; day.getTime() <= today.getTime(); day.setUTCDate(day.getUTCDate() + 1)) {
    const dayMs = day.getTime();

    let cash = 0;
    let credits = 0;
    let otherAssets = 0;
    for (const [id, arr] of cashByAccount) {
      let p = ptr.get(`c:${id}`)!;
      while (p + 1 < arr.length && arr[p + 1].date <= dayMs) p++;
      ptr.set(`c:${id}`, p);
      if (p < 0) continue;

      const account = accountsById.get(id);
      if (account?.category === "CREDIT") credits += arr[p].value;
      else if (account?.category === "OTHER_ASSET") otherAssets += arr[p].value;
      else if (account?.type !== "BROKER") cash += arr[p].value;
    }

    let debts = 0;
    for (const [id, arr] of debtById) {
      let p = ptr.get(`d:${id}`)!;
      while (p + 1 < arr.length && arr[p + 1].date <= dayMs) p++;
      ptr.set(`d:${id}`, p);
      if (p >= 0) debts += arr[p].value;
    }

    const investments = invByDate.get(isoDay(day)) ?? 0;
    points.push({
      date: isoDay(day),
      cash,
      credits,
      otherAssets,
      investments,
      debts,
      totalValue: cash + credits + otherAssets + investments - debts,
    });
  }
  return points;
}
