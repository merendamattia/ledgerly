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
  if (!tickerId) return;
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

test("countByTickerIds returns stored price counts in one aggregate", async () => {
  const counts = await priceRepository.countByTickerIds([tickerId, "missing"]);

  expect(counts.get(tickerId)).toBe(2);
  expect(counts.get("missing")).toBeUndefined();
});

test("latestByTickerIds returns the newest close for each ticker", async () => {
  const latest = await priceRepository.latestByTickerIds([tickerId, "missing"]);

  expect(Number(latest.get(tickerId)?.close)).toBe(101);
  expect(latest.get(tickerId)?.date.toISOString().slice(0, 10)).toBe("2024-01-02");
  expect(latest.get("missing")).toBeUndefined();
});
