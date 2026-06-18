import { test, expect, beforeAll, afterAll } from "bun:test";
import { prisma } from "../src/core/db.ts";
import { createCashSnapshot, deleteCashSnapshot } from "../src/services/snapshot.ts";
import { cashSnapshotRepository } from "../src/repositories/cashSnapshot.ts";

// Integration test (requires Postgres). Deleting a cash snapshot removes the row
// and reverts the account's cached balance to the most recent remaining snapshot.
let accountId: string;

beforeAll(async () => {
  const account = await prisma.cashAccount.create({
    data: {
      name: `Snapshot Delete Test ${Date.now()}`,
      type: "BANK",
      category: "LIQUIDITY",
      currency: "EUR",
      balance: 0,
    },
  });
  accountId = account.id;
});

afterAll(async () => {
  await prisma.cashAccount.delete({ where: { id: accountId } });
});

test("deleting the latest snapshot reverts the cached balance to the prior one", async () => {
  await createCashSnapshot(new Date("2024-01-01"), [{ accountId, balance: 100 }]);
  const [latest] = await createCashSnapshot(new Date("2024-01-02"), [{ accountId, balance: 250 }]);

  // Cached balance reflects the latest snapshot before deletion.
  let account = await prisma.cashAccount.findUniqueOrThrow({ where: { id: accountId } });
  expect(Number(account.balance)).toBe(250);

  const deleted = await deleteCashSnapshot(latest.id);
  expect(deleted).not.toBeNull();
  expect(await cashSnapshotRepository.findById(latest.id)).toBeNull();

  // Balance reverts to the remaining (2024-01-01) snapshot.
  account = await prisma.cashAccount.findUniqueOrThrow({ where: { id: accountId } });
  expect(Number(account.balance)).toBe(100);
});

test("deleting a non-existent snapshot returns null", async () => {
  expect(await deleteCashSnapshot("does-not-exist")).toBeNull();
});
