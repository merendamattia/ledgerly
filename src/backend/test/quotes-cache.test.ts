import { afterAll, beforeAll, expect, test } from "bun:test";
import { prisma } from "../src/core/db.ts";
import { invalidatePrice, latestPrices } from "../src/services/market/quotes.ts";
import { ensureTestUser, TEST_USER_ID } from "./fixtures.ts";

const symbol = `TEST.QUOTE.CACHE.${Date.now()}`;
let tickerId: string;

beforeAll(async () => {
  await ensureTestUser();
  const ticker = await prisma.ticker.create({
    data: { userId: TEST_USER_ID, symbol, name: "Quote Cache Test", type: "ETF", currency: "EUR", provider: "yahoo" },
  });
  tickerId = ticker.id;
  await prisma.priceHistory.createMany({
    data: [
      { tickerId, date: new Date("2024-02-01T00:00:00.000Z"), close: 100 },
      { tickerId, date: new Date("2024-02-02T00:00:00.000Z"), close: 101 },
    ],
  });
  await invalidatePrice(tickerId);
});

afterAll(async () => {
  if (!tickerId) return;
  await invalidatePrice(tickerId);
  await prisma.priceHistory.deleteMany({ where: { tickerId } });
  await prisma.ticker.delete({ where: { id: tickerId } });
});

test("latestPrices reads Redis before falling back to Postgres", async () => {
  const first = await latestPrices([tickerId]);
  expect(first.get(tickerId)?.close).toBe(101);

  await prisma.priceHistory.deleteMany({ where: { tickerId } });

  const cached = await latestPrices([tickerId]);
  expect(cached.get(tickerId)?.close).toBe(101);
});
