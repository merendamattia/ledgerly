import { afterAll, beforeAll, expect, test } from "bun:test";
import { prisma } from "../src/core/db.ts";
import { importService } from "../src/services/import.ts";
import { ensureTestUser, TEST_USER_ID } from "./fixtures.ts";

const suffix = Date.now();
const category = `codex import ${suffix}`;
const timestampCategory = `codex import timestamp ${suffix}`;
const notes = [`first ${suffix}`, `second ${suffix}`, `timestamp ${suffix}`];

beforeAll(async () => {
  await ensureTestUser();
});

afterAll(async () => {
  await prisma.transaction.deleteMany({ where: { userId: TEST_USER_ID, note: { in: notes } } });
  await prisma.category.deleteMany({
    where: { userId: TEST_USER_ID, name: { in: [category, timestampCategory] }, kind: "EXPENSE" },
  });
});

test("commit reuses one category and skips duplicate import rows", async () => {
  const rows = [
    {
      direction: "EXPENSE" as const,
      category,
      date: new Date("2024-03-01T00:00:00Z"),
      amount: 10,
      note: notes[0],
    },
    {
      direction: "EXPENSE" as const,
      category,
      date: new Date("2024-03-01T00:00:00Z"),
      amount: 10,
      note: notes[0],
    },
    {
      direction: "EXPENSE" as const,
      category,
      date: new Date("2024-03-02T00:00:00Z"),
      amount: 12,
      note: notes[1],
    },
  ];

  expect(await importService.commit(TEST_USER_ID, rows)).toEqual({
    imported: 2,
    skipped: 1,
    createdCategories: 1,
  });

  const storedCategory = await prisma.category.findFirstOrThrow({
    where: { userId: TEST_USER_ID, kind: "EXPENSE", name: category },
  });
  const storedTransactions = await prisma.transaction.count({
    where: { categoryId: storedCategory.id, note: { in: notes } },
  });

  expect(storedTransactions).toBe(2);
  expect(await importService.commit(TEST_USER_ID, rows)).toEqual({
    imported: 0,
    skipped: 3,
    createdCategories: 0,
  });
});

test("commit matches existing duplicates across the same ISO day", async () => {
  const storedCategory = await prisma.category.create({
    data: { userId: TEST_USER_ID, name: timestampCategory, kind: "EXPENSE" },
  });
  await prisma.transaction.create({
    data: {
      userId: TEST_USER_ID,
      categoryId: storedCategory.id,
      date: new Date("2024-04-10T00:00:00.000Z"),
      amount: 42,
      direction: "EXPENSE",
      note: notes[2],
    },
  });

  expect(
    await importService.commit(TEST_USER_ID, [
      {
        direction: "EXPENSE",
        category: timestampCategory,
        date: new Date("2024-04-10T15:45:00.000Z"),
        amount: 42,
        note: notes[2],
      },
    ]),
  ).toEqual({ imported: 0, skipped: 1, createdCategories: 0 });
});
