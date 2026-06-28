import { afterAll, beforeAll, expect, test } from "bun:test";
import { prisma } from "../src/core/db.ts";
import { cashSnapshotRepository } from "../src/repositories/cashSnapshot.ts";
import { debtSnapshotRepository } from "../src/repositories/debtSnapshot.ts";
import { createCashSnapshot, createDebtSnapshot } from "../src/services/snapshot.ts";

let accountId: string | null = null;
let debtId: string | null = null;

beforeAll(async () => {
  const suffix = Date.now();
  const [account, debt] = await Promise.all([
    prisma.cashAccount.create({
      data: {
        name: `Snapshot Notes Account ${suffix}`,
        type: "BANK",
        category: "LIQUIDITY",
        currency: "EUR",
        balance: 0,
      },
    }),
    prisma.debt.create({
      data: {
        name: `Snapshot Notes Debt ${suffix}`,
        type: "LOAN",
        currency: "EUR",
        amount: 0,
      },
    }),
  ]);
  accountId = account.id;
  debtId = debt.id;
});

afterAll(async () => {
  await Promise.all([
    accountId ? prisma.cashAccount.delete({ where: { id: accountId } }) : Promise.resolve(),
    debtId ? prisma.debt.delete({ where: { id: debtId } }) : Promise.resolve(),
  ]);
});

test("persists and updates notes for cash snapshot fields", async () => {
  const [created] = await createCashSnapshot(new Date("2024-02-01"), [
    { accountId: accountId!, balance: 100, note: "Initial cash note" },
  ]);

  expect(created.note).toBe("Initial cash note");

  const [updated] = await createCashSnapshot(new Date("2024-02-01"), [
    { accountId: accountId!, balance: 120, note: "Updated cash note" },
  ]);
  const stored = await cashSnapshotRepository.findById(updated.id);

  expect(updated.id).toBe(created.id);
  expect(updated.note).toBe("Updated cash note");
  expect(stored?.note).toBe("Updated cash note");
});

test("persists and updates notes for debt snapshot fields", async () => {
  const [created] = await createDebtSnapshot(new Date("2024-02-01"), [
    { debtId: debtId!, amount: 500, note: "Initial debt note" },
  ]);

  expect(created.note).toBe("Initial debt note");

  const [updated] = await createDebtSnapshot(new Date("2024-02-01"), [
    { debtId: debtId!, amount: 450, note: "Updated debt note" },
  ]);
  const stored = await debtSnapshotRepository.findById(updated.id);

  expect(updated.id).toBe(created.id);
  expect(updated.note).toBe("Updated debt note");
  expect(stored?.note).toBe("Updated debt note");
});
