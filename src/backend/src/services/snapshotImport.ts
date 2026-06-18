import { z } from "zod";
import type { snapshotImportCommitSchema } from "../schemas/index.ts";
import { cashAccountRepository } from "../repositories/cashAccount.ts";
import { debtRepository } from "../repositories/debt.ts";
import { createCashSnapshot, createDebtSnapshot } from "./snapshot.ts";
import { parseInvestmentDate, parseLocaleNumber } from "../utils/investment-csv.ts";

type CommitInput = z.infer<typeof snapshotImportCommitSchema>;

interface Target {
  kind: "CASH" | "DEBT";
  id: string;
}

export interface SnapshotImportResult {
  accountsCreated: number;
  snapshotsImported: number;
  skipped: number;
  errors: { line: number; message: string }[];
}

export const snapshotImportService = {
  /**
   * Commit a bulk snapshot import. Resolves/creates each mapped column's target,
   * then upserts a dated snapshot per (account, date). Rows are applied oldest →
   * newest so each account's cached balance ends at its most recent value.
   */
  async commit(input: CommitInput): Promise<SnapshotImportResult> {
    const result: SnapshotImportResult = {
      accountsCreated: 0,
      snapshotsImported: 0,
      skipped: 0,
      errors: [],
    };

    // 1. Resolve every non-skipped column to a concrete cash account / debt.
    const targetByIndex = new Map<number, Target>();
    for (const col of input.columns) {
      if (col.action === "skip") continue;
      if (col.action === "existing") {
        targetByIndex.set(col.index, { kind: col.kind, id: col.id });
        continue;
      }
      // create
      if (col.kind === "DEBT") {
        const debt = await debtRepository.create({
          name: col.name,
          currency: col.currency,
          amount: 0,
        });
        targetByIndex.set(col.index, { kind: "DEBT", id: debt.id });
      } else {
        const account = await cashAccountRepository.create({
          name: col.name,
          category: col.kind,
          currency: col.currency,
          balance: 0,
        });
        targetByIndex.set(col.index, { kind: "CASH", id: account.id });
      }
      result.accountsCreated += 1;
    }

    // 2. Parse rows into dated entries, dropping empty/invalid cells.
    const parsed: { date: Date; cash: { accountId: string; balance: number }[]; debt: { debtId: string; amount: number }[] }[] = [];
    input.rows.forEach((row, i) => {
      const line = i + 2; // +1 for the stripped header, +1 for 1-based lines
      const dateRaw = row[input.dateColumn] ?? "";
      const date = parseInvestmentDate(dateRaw);
      if (!date) {
        result.errors.push({ line, message: `Invalid or missing date "${dateRaw}"` });
        result.skipped += 1;
        return;
      }

      const cash: { accountId: string; balance: number }[] = [];
      const debt: { debtId: string; amount: number }[] = [];
      for (const [index, target] of targetByIndex) {
        const raw = (row[index] ?? "").trim();
        if (raw.length === 0) continue; // a blank cell = no snapshot for that day
        const value = parseLocaleNumber(raw);
        if (!Number.isFinite(value)) {
          result.errors.push({ line, message: `Invalid number "${raw}"` });
          continue;
        }
        if (target.kind === "CASH") cash.push({ accountId: target.id, balance: value });
        else debt.push({ debtId: target.id, amount: value });
      }
      if (cash.length === 0 && debt.length === 0) return;
      parsed.push({ date, cash, debt });
    });

    // 3. Apply oldest → newest so cached balances land on the latest value.
    parsed.sort((a, b) => a.date.getTime() - b.date.getTime());
    for (const p of parsed) {
      if (p.cash.length > 0) {
        await createCashSnapshot(p.date, p.cash);
        result.snapshotsImported += p.cash.length;
      }
      if (p.debt.length > 0) {
        await createDebtSnapshot(p.date, p.debt);
        result.snapshotsImported += p.debt.length;
      }
    }

    return result;
  },
};
