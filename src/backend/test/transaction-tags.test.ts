import { afterAll, beforeAll, expect, test } from "bun:test";
import { prisma } from "../src/core/db.ts";
import { transactionRepository } from "../src/repositories/transaction.ts";
import { ensureTestUser, TEST_USER_ID } from "./fixtures.ts";
import {
  invalidateTransactionTagCache,
  listTransactionTags,
} from "../src/services/transactionTags.ts";

const suffix = Date.now();
const categoryName = `codex tags ${suffix}`;
const notes = [`#Rome first ${suffix}`, `#Lisbon second ${suffix}`];
let categoryId: string;

beforeAll(async () => {
  await ensureTestUser();
  await invalidateTransactionTagCache();
  const category = await prisma.category.create({
    data: { userId: TEST_USER_ID, name: categoryName, kind: "EXPENSE" },
  });
  categoryId = category.id;
  await transactionRepository.create(TEST_USER_ID, {
    date: new Date("2024-07-01T00:00:00.000Z"),
    amount: 10,
    direction: "EXPENSE",
    note: notes[0],
    category: { connect: { id: categoryId } },
  });
});

afterAll(async () => {
  await prisma.transaction.deleteMany({ where: { note: { in: notes } } });
  if (categoryId) await prisma.category.delete({ where: { id: categoryId } });
  await invalidateTransactionTagCache();
});

test("listTransactionTags uses Redis cache and repository writes invalidate it", async () => {
  const filters = {
    from: new Date("2024-07-01T00:00:00.000Z"),
    to: new Date("2024-07-31T23:59:59.999Z"),
  };

  expect(await listTransactionTags(TEST_USER_ID, filters)).toContain("Rome");

  await transactionRepository.create(TEST_USER_ID, {
    date: new Date("2024-07-02T00:00:00.000Z"),
    amount: 12,
    direction: "EXPENSE",
    note: notes[1],
    category: { connect: { id: categoryId } },
  });

  expect(await listTransactionTags(TEST_USER_ID, filters)).toEqual(
    expect.arrayContaining(["Rome", "Lisbon"]),
  );
});
