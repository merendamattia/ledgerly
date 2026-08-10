import { afterAll, beforeAll, expect, test } from "bun:test";
import { prisma } from "../src/core/db.ts";
import { transactionRepository } from "../src/repositories/transaction.ts";

const suffix = Date.now();
const categoryName = `codex tx repo ${suffix}`;
const notes = [`repo outside ${suffix}`, `repo inside ${suffix}`];
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
    ],
  });
});

afterAll(async () => {
  await prisma.transaction.deleteMany({ where: { note: { in: notes } } });
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
