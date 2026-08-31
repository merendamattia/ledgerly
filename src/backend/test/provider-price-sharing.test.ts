import { afterAll, beforeAll, expect, test } from "bun:test";
import { prisma } from "../src/core/db.ts";
import { priceRepository } from "../src/repositories/price.ts";
import { uniqueProviderTickers } from "../src/services/cron/jobs.ts";

const suffix = `${Date.now()}-${process.pid}`;
const userAId = `price-user-a-${suffix}`;
const userBId = `price-user-b-${suffix}`;
const symbol = `SHARED.PRICE.${suffix}`;
let tickerAId = "";
let tickerBId = "";

beforeAll(async () => {
  await prisma.user.createMany({
    data: [
      { id: userAId, name: "Price User A", email: `price-a-${suffix}@example.com` },
      { id: userBId, name: "Price User B", email: `price-b-${suffix}@example.com` },
    ],
  });

  const [tickerA, tickerB] = await Promise.all([
    prisma.ticker.create({
      data: {
        userId: userAId,
        symbol,
        name: "Shared Price A",
        type: "ETF",
        currency: "USD",
        provider: "yahoo",
      },
    }),
    prisma.ticker.create({
      data: {
        userId: userBId,
        symbol,
        name: "Shared Price B",
        type: "ETF",
        currency: "USD",
        provider: "yahoo",
      },
    }),
  ]);
  tickerAId = tickerA.id;
  tickerBId = tickerB.id;
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { id: { in: [userAId, userBId] } } });
  await prisma.providerPriceHistory.deleteMany({ where: { provider: "yahoo", symbol } });
});

test("two users tracking one provider symbol share its history and one backfill source", async () => {
  const bars = [
    { date: new Date("2026-01-01"), close: 100 },
    { date: new Date("2026-01-02"), close: 101 },
  ];

  expect(await priceRepository.bulkInsert(tickerAId, bars)).toBe(2);
  expect(
    await prisma.providerPriceHistory.count({ where: { provider: "yahoo", symbol } }),
  ).toBe(2);

  const userBHistory = await priceRepository.series(tickerBId);
  expect(userBHistory.map((row) => ({ date: row.date.toISOString(), close: Number(row.close) }))).toEqual([
    { date: "2026-01-01T00:00:00.000Z", close: 100 },
    { date: "2026-01-02T00:00:00.000Z", close: 101 },
  ]);

  await priceRepository.upsert(tickerAId, new Date("2026-01-01"), 99);
  const userAHistory = await priceRepository.series(tickerAId);
  expect(Number(userAHistory[0]?.close)).toBe(99);
  expect(Number((await priceRepository.series(tickerBId))[0]?.close)).toBe(100);

  const tickers = await prisma.ticker.findMany({ where: { id: { in: [tickerAId, tickerBId] } } });
  expect(uniqueProviderTickers(tickers)).toHaveLength(1);
});
