import { test, expect, beforeAll, afterAll } from "bun:test";
import { prisma } from "../src/core/db.ts";
import { priceRepository } from "../src/repositories/price.ts";

// Integration test (requires Postgres). Verifies the backfill insert is
// idempotent thanks to the unique (tickerId, date) constraint.
const symbol = `TEST.IDEM.${Date.now()}`;
let tickerId: string;

beforeAll(async () => {
  const ticker = await prisma.ticker.create({
    data: { symbol, name: "Idempotency Test", type: "ETF", currency: "EUR", provider: "yahoo" },
  });
  tickerId = ticker.id;
});

afterAll(async () => {
  await prisma.ticker.delete({ where: { id: tickerId } });
});

test("bulkInsert inserts new bars and skips duplicates", async () => {
  const bars = [
    { date: new Date("2024-01-01"), close: 100 },
    { date: new Date("2024-01-02"), close: 101 },
  ];

  const first = await priceRepository.bulkInsert(tickerId, bars);
  expect(first).toBe(2);

  const second = await priceRepository.bulkInsert(tickerId, bars);
  expect(second).toBe(0);

  expect(await priceRepository.count(tickerId)).toBe(2);
});
