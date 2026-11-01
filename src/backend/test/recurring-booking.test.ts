import { afterAll, afterEach, beforeAll, expect, test } from "bun:test";
import { app } from "../src/api/app.ts";
import { auth } from "../src/core/auth.ts";
import { prisma } from "../src/core/db.ts";
import { recurringExpenseRepository } from "../src/repositories/recurringExpense.ts";
import { generateDue, updateRecurring } from "../src/services/recurring.ts";

let userId: string;
let cookie: string;
const email = `recurring-${crypto.randomUUID()}@example.com`;
const password = "recurring-password-123";

beforeAll(async () => {
  const { user } = await auth.api.createUser({
    body: { email, password, name: "Recurring test owner", role: "user" },
  });
  userId = user.id;
  await prisma.user.update({ where: { id: userId }, data: { mustChangePassword: false } });
  const response = await auth.handler(new Request("http://localhost:3001/api/auth/sign-in/email", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": "192.0.2.81" },
    body: JSON.stringify({ email, password }),
  }));
  expect(response.status).toBe(200);
  cookie = response.headers.get("set-cookie")!.split(";", 1)[0];
});

afterAll(async () => {
  if (userId) await prisma.user.delete({ where: { id: userId } });
});

afterEach(async () => {
  await prisma.recurringExpense.updateMany({ where: { userId }, data: { enabled: false } });
});

async function createRule(direction: "INCOME" | "EXPENSE" = "EXPENSE") {
  return prisma.recurringExpense.create({ data: {
    userId, amount: 10, direction, note: "Original note",
    startDate: new Date("2026-01-01"), nextRunDate: new Date("2026-01-01"),
    intervalUnit: "MONTH", intervalCount: 1,
  } });
}

async function edit(id: string, body: object) {
  const response = await app.request(`/api/recurring-expenses/${id}`, {
    method: "PUT", headers: { cookie, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  expect(response.status).toBe(200);
  return response.json() as Promise<{ nextRunDate: string; occurrencesCount: number }>;
}

for (const direction of ["EXPENSE", "INCOME"] as const) {
  test(`${direction}: amount edits and repeated form saves preserve January–October history`, async () => {
    const rule = await createRule(direction);
    await generateDue(userId, new Date("2026-10-01"));
    const historical = await prisma.transaction.findMany({ where: { recurringExpenseId: rule.id } });
    expect(historical).toHaveLength(10);

    const payload = {
      amount: 15, startDate: "2026-01-01", intervalUnit: "MONTH", intervalCount: 1,
      direction, note: "Edited note", endMode: "NEVER", maxOccurrences: null, endDate: null, enabled: true,
    };
    for (let i = 0; i < 2; i++) {
      const updated = await edit(rule.id, payload);
      expect(updated.nextRunDate.slice(0, 10)).toBe("2026-11-01");
      expect(updated.occurrencesCount).toBe(10);
    }
    await generateDue(userId, new Date("2026-11-01"));
    await generateDue(userId, new Date("2026-11-01"));
    const rows = await prisma.transaction.findMany({ where: { recurringExpenseId: rule.id }, orderBy: { date: "asc" } });
    expect(rows).toHaveLength(11);
    expect(rows.slice(0, 10)).toEqual(historical.sort((a, b) => a.date.getTime() - b.date.getTime()));
    expect(Number(rows[10].amount)).toBe(15);
    expect(rows[10].note).toBe("Edited note");
    await prisma.recurringExpense.update({ where: { id: rule.id }, data: { enabled: false } });
  });
}

test("concurrent generators and retries book each rule/date once, independently of other rules", async () => {
  const first = await createRule();
  const second = await createRule();
  const results = await Promise.all(Array.from({ length: 5 }, () => generateDue(userId, new Date("2026-03-01"))));
  expect(results.reduce((sum, count) => sum + count, 0)).toBe(6);
  expect(await generateDue(userId, new Date("2026-03-01"))).toBe(0);
  for (const rule of [first, second]) {
    const rows = await prisma.transaction.findMany({ where: { recurringExpenseId: rule.id } });
    expect(rows.map((row) => row.date.toISOString().slice(0, 10)).sort()).toEqual(["2026-01-01", "2026-02-01", "2026-03-01"]);
    const stored = await prisma.recurringExpense.findUniqueOrThrow({ where: { id: rule.id } });
    expect(stored.occurrencesCount).toBe(3);
    expect(stored.nextRunDate.toISOString().slice(0, 10)).toBe("2026-04-01");
  }
});

test("cadence and anchor changes retain counts and skip all dates before the old cursor and edit day", async () => {
  const rule = await createRule();
  await generateDue(userId, new Date("2026-10-01"));
  const historical = await prisma.transaction.findMany({ where: { recurringExpenseId: rule.id }, orderBy: { date: "asc" } });
  const updated = await updateRecurring(userId, rule.id, {
    startDate: new Date("2026-01-15"), intervalCount: 2,
    endMode: "AFTER_OCCURRENCES", maxOccurrences: 12,
  }, new Date("2026-11-02"));
  expect(updated!.nextRunDate.toISOString().slice(0, 10)).toBe("2026-11-15");
  expect(updated!.occurrencesCount).toBe(10);
  await generateDue(userId, new Date("2027-12-31"));
  const stored = await prisma.recurringExpense.findUniqueOrThrow({ where: { id: rule.id } });
  expect(stored.occurrencesCount).toBe(12);
  expect(stored.enabled).toBe(false);
  const rows = await prisma.transaction.findMany({ where: { recurringExpenseId: rule.id }, orderBy: { date: "asc" } });
  expect(rows.slice(0, 10)).toEqual(historical);
  expect(rows.slice(10).map((row) => row.date.toISOString().slice(0, 10))).toEqual(["2026-11-15", "2027-01-15"]);
});

test("resuming skips paused months without consuming the remaining occurrence count", async () => {
  const rule = await createRule();
  await generateDue(userId, new Date("2026-01-01"));
  await updateRecurring(userId, rule.id, { enabled: false }, new Date("2026-01-10"));
  expect(await generateDue(userId, new Date("2026-03-01"))).toBe(0);
  const resumed = await updateRecurring(userId, rule.id, {
    enabled: true, endMode: "AFTER_OCCURRENCES", maxOccurrences: 2,
  }, new Date("2026-03-15"));
  expect(resumed!.nextRunDate.toISOString().slice(0, 10)).toBe("2026-04-01");
  expect(resumed!.occurrencesCount).toBe(1);
  expect(await generateDue(userId, new Date("2026-04-01"))).toBe(1);
  expect(await generateDue(userId, new Date("2026-05-01"))).toBe(0);
});

test("end-date edits stop generation without modifying historical rows or resetting the cursor", async () => {
  const rule = await createRule();
  await generateDue(userId, new Date("2026-10-01"));
  const updated = await updateRecurring(userId, rule.id, {
    endMode: "ON_DATE", endDate: new Date("2026-10-15"),
  }, new Date("2026-10-20"));
  expect(updated!.occurrencesCount).toBe(10);
  expect(updated!.nextRunDate.toISOString().slice(0, 10)).toBe("2026-11-01");
  expect(updated!.enabled).toBe(false);
  expect(await generateDue(userId, new Date("2027-01-01"))).toBe(0);
  expect(await prisma.transaction.count({ where: { recurringExpenseId: rule.id } })).toBe(10);
});

test("month-end edits keep the established clamped cadence and ON_DATE includes the final date", async () => {
  const rule = await createRule();
  await prisma.recurringExpense.update({ where: { id: rule.id }, data: {
    startDate: new Date("2028-01-31"), nextRunDate: new Date("2028-01-31"),
    endMode: "ON_DATE", endDate: new Date("2028-03-29"),
  } });
  expect(await generateDue(userId, new Date("2028-02-29"))).toBe(2);
  await edit(rule.id, { amount: 15, startDate: "2028-01-31", intervalUnit: "MONTH", intervalCount: 1 });
  expect(await generateDue(userId, new Date("2028-03-29"))).toBe(1);
  expect(await generateDue(userId, new Date("2028-04-30"))).toBe(0);
  const rows = await prisma.transaction.findMany({ where: { recurringExpenseId: rule.id }, orderBy: { date: "asc" } });
  expect(rows.map((row) => [row.date.toISOString().slice(0, 10), Number(row.amount)])).toEqual([
    ["2028-01-31", 10], ["2028-02-29", 10], ["2028-03-29", 15],
  ]);
});

test("manual date edits and deletion of booked transactions do not replay their scheduled occurrence", async () => {
  const rule = await createRule();
  await generateDue(userId, new Date("2026-02-01"));
  const rows = await prisma.transaction.findMany({ where: { recurringExpenseId: rule.id }, orderBy: { date: "asc" } });
  await prisma.transaction.update({ where: { id: rows[0].id }, data: { date: new Date("2026-03-01"), amount: 99 } });
  await prisma.transaction.delete({ where: { id: rows[1].id } });
  expect(await generateDue(userId, new Date("2026-02-01"))).toBe(0);
  expect(await generateDue(userId, new Date("2026-03-01"))).toBe(1);
  const remaining = await prisma.transaction.findMany({ where: { recurringExpenseId: rule.id }, orderBy: { amount: "asc" } });
  expect(remaining.map((row) => Number(row.amount))).toEqual([10, 99]);
});

test("booking failure rolls back inserted movements and progress, then a retry succeeds once", async () => {
  const rule = await createRule();
  await expect(recurringExpenseRepository.bookDue(userId, rule.id, () => ({
    dates: [new Date("2026-01-01")], nextRunDate: new Date("2026-02-01"),
    // PostgreSQL rejects this integer only after the movement insert has executed.
    occurrencesCount: 2 ** 31, enabled: true,
  }))).rejects.toThrow();
  expect(await prisma.transaction.count({ where: { recurringExpenseId: rule.id } })).toBe(0);
  const stored = await prisma.recurringExpense.findUniqueOrThrow({ where: { id: rule.id } });
  expect(stored.occurrencesCount).toBe(0);
  expect(stored.nextRunDate).toEqual(rule.nextRunDate);
  expect(await generateDue(userId, new Date("2026-01-01"))).toBe(1);
  expect(await generateDue(userId, new Date("2026-01-01"))).toBe(0);
});

test("an edit racing the generator cannot overwrite committed progress", async () => {
  const rule = await createRule();
  await Promise.all([
    generateDue(userId, new Date("2026-10-01")),
    edit(rule.id, { amount: 15, startDate: "2026-01-01", intervalUnit: "MONTH", intervalCount: 1 }),
  ]);
  const stored = await prisma.recurringExpense.findUniqueOrThrow({ where: { id: rule.id } });
  expect(stored.occurrencesCount).toBe(10);
  expect(stored.nextRunDate.toISOString().slice(0, 10)).toBe("2026-11-01");
  expect(await generateDue(userId, new Date("2026-10-01"))).toBe(0);
  expect(await prisma.transaction.count({ where: { recurringExpenseId: rule.id } })).toBe(10);
});

test("a monthly-to-weekly schedule edit uses only future dates and preserves lifetime progress", async () => {
  const rule = await createRule();
  await generateDue(userId, new Date("2026-10-01"));
  const updated = await updateRecurring(userId, rule.id, {
    intervalUnit: "WEEK", intervalCount: 1, startDate: new Date("2026-01-01"),
  }, new Date("2026-11-03"));
  expect(updated!.nextRunDate.toISOString().slice(0, 10)).toBe("2026-11-05");
  expect(updated!.occurrencesCount).toBe(10);
  expect(await generateDue(userId, new Date("2026-11-04"))).toBe(0);
  expect(await generateDue(userId, new Date("2026-11-05"))).toBe(1);
});

test("descriptive and empty partial updates preserve progress and an existing end condition", async () => {
  const rule = await createRule();
  await generateDue(userId, new Date("2026-10-01"));
  await updateRecurring(userId, rule.id, { endMode: "AFTER_OCCURRENCES", maxOccurrences: 11 });
  for (const payload of [{}, { note: "Only the note changed" }]) {
    const updated = await edit(rule.id, payload);
    expect(updated.nextRunDate.slice(0, 10)).toBe("2026-11-01");
    expect(updated.occurrencesCount).toBe(10);
  }
  expect(await generateDue(userId, new Date("2026-12-01"))).toBe(1);
  const stored = await prisma.recurringExpense.findUniqueOrThrow({ where: { id: rule.id } });
  expect(stored.endMode).toBe("AFTER_OCCURRENCES");
  expect(stored.occurrencesCount).toBe(11);
  expect(stored.enabled).toBe(false);
});
