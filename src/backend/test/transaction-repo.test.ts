import { afterAll, beforeAll, expect, test } from "bun:test";
import { prisma } from "../src/core/db.ts";
import { transactionRepository } from "../src/repositories/transaction.ts";

const suffix = Date.now();
const categoryName = `codex tx repo ${suffix}`;
const notes = [`repo outside ${suffix}`, `repo inside ${suffix}`];
const summaryNotes = [`summary expense ${suffix}`, `summary income ${suffix}`];
const completeNotes = Array.from({ length: 5_001 }, (_, index) => `complete ${suffix} ${index}`);
let categoryId: string;

beforeAll(async () => {
  const category = await prisma.category.create({
    data: { name: categoryName, kind: "EXPENSE" },
  });
  categoryId = category.id;

  await prisma.transaction.createMany({
    data: [
      {
        categoryId,
        date: new Date("2024-05-01T00:00:00.000Z"),
        amount: 11,
        direction: "EXPENSE",
        note: notes[0],
      },
      {
        categoryId,
        date: new Date("2024-05-02T00:00:00.000Z"),
        amount: 12,
        direction: "EXPENSE",
        note: notes[1],
      },
      {
        categoryId,
        date: new Date("2024-05-03T00:00:00.000Z"),
        amount: 30,
        direction: "EXPENSE",
        note: summaryNotes[0],
      },
      {
        date: new Date("2024-05-03T00:00:00.000Z"),
        amount: 100,
        direction: "INCOME",
        note: summaryNotes[1],
      },
    ],
  });

  await prisma.transaction.createMany({
    data: completeNotes.map((note, index) => ({
      categoryId,
      date: new Date("2024-06-01T00:00:00.000Z"),
      amount: index + 1,
      direction: "EXPENSE" as const,
      note,
    })),
  });
});

afterAll(async () => {
  await prisma.transaction.deleteMany({
    where: {
      OR: [
        { note: { in: [...notes, ...summaryNotes] } },
        { note: { startsWith: `complete ${suffix} ` } },
      ],
    },
  });
  if (categoryId) await prisma.category.delete({ where: { id: categoryId } });
});

test("naturalKeys limits duplicate preload to the requested date range", async () => {
  const keys = await transactionRepository.naturalKeys({
    from: new Date("2024-05-02T00:00:00.000Z"),
    to: new Date("2024-05-02T23:59:59.999Z"),
  });

  const returnedNotes = keys
    .map((key) => key.note)
    .filter((note): note is string => notes.includes(note ?? ""));

  expect(returnedNotes).toEqual([notes[1]]);
});

test("list searches matching transactions before applying pagination", async () => {
  const rows = await transactionRepository.list({ search: notes[0], limit: 1 });

  expect(rows.map((row) => row.note)).toEqual([notes[0]]);
});

test("summary applies date, search, direction, and category filters", async () => {
  await expect(
    transactionRepository.summary({
      from: new Date("2024-05-03T00:00:00.000Z"),
      to: new Date("2024-05-03T23:59:59.999Z"),
      search: "summary",
    }),
  ).resolves.toEqual({ income: 100, expenses: 30, net: 70 });

  await expect(
    transactionRepository.summary({
      direction: "EXPENSE",
      categoryId,
      search: summaryNotes[0],
    }),
  ).resolves.toEqual({ income: 0, expenses: 30, net: -30 });
});

test("list without a limit returns every bounded row beyond the API page size", async () => {
  const rows = await transactionRepository.list({
    from: new Date("2024-06-01T00:00:00.000Z"),
    to: new Date("2024-06-01T23:59:59.999Z"),
  });

  expect(rows).toHaveLength(5_001);
});
