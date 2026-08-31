import { test, expect } from "bun:test";
import { Prisma } from "@prisma/client";
import { serializeAccount, serializeTransaction } from "./serialize.ts";

test("serializeAccount converts Decimal balance to a number", () => {
  const result = serializeAccount({
    id: "a1",
    userId: "test-user",
    name: "Bank",
    type: "BANK",
    category: "LIQUIDITY",
    currency: "EUR",
    balance: new Prisma.Decimal("1234.50"),
    note: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  expect(result.balance).toBe(1234.5);
  expect(typeof result.balance).toBe("number");
});

test("serializeTransaction converts Decimal amount to a number", () => {
  const result = serializeTransaction({
    id: "t1",
    userId: "test-user",
    categoryId: null,
    date: new Date("2026-01-01"),
    amount: new Prisma.Decimal("80.00"),
    direction: "EXPENSE",
    note: null,
    recurringExpenseId: null,
    createdAt: new Date(),
  });
  expect(result.amount).toBe(80);
  expect(typeof result.amount).toBe("number");
});
