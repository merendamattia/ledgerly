import { afterAll, beforeAll, expect, test } from "bun:test";
import { prisma } from "../src/core/db.ts";
import { investmentTransactionRepository } from "../src/repositories/investmentTransaction.ts";

const suffix = Date.now();
let accountId: string;
let tickerAId: string;
let tickerBId: string;

beforeAll(async () => {
  const account = await prisma.cashAccount.create({
    data: {
      name: `Investment Repo ${suffix}`,
      type: "BROKER",
      category: "LIQUIDITY",
      currency: "EUR",
      balance: 0,
    },
  });
  accountId = account.id;

  const [tickerA, tickerB] = await Promise.all([
    prisma.ticker.create({
      data: {
        symbol: `INV.REPO.A.${suffix}`,
        name: "Investment Repo A",
        type: "ETF",
        currency: "EUR",
        provider: "manual",
      },
    }),
    prisma.ticker.create({
      data: {
        symbol: `INV.REPO.B.${suffix}`,
        name: "Investment Repo B",
        type: "ETF",
        currency: "EUR",
        provider: "manual",
      },
    }),
  ]);
  tickerAId = tickerA.id;
  tickerBId = tickerB.id;

  await prisma.investmentTransaction.createMany({
    data: [
      {
        tickerId: tickerAId,
        cashAccountId: accountId,
        date: new Date("2024-06-01T00:00:00.000Z"),
        side: "BUY",
        quantity: 1,
        price: 10,
      },
      {
        tickerId: tickerAId,
        cashAccountId: accountId,
        date: new Date("2024-06-02T00:00:00.000Z"),
        side: "BUY",
        quantity: 2,
        price: 20,
      },
      {
        tickerId: tickerBId,
        cashAccountId: accountId,
        date: new Date("2024-06-02T00:00:00.000Z"),
        side: "BUY",
        quantity: 3,
        price: 30,
      },
    ],
  });
});

afterAll(async () => {
  await prisma.investmentTransaction.deleteMany({
    where: { tickerId: { in: [tickerAId, tickerBId].filter(Boolean) } },
  });
  if (tickerAId) await prisma.ticker.delete({ where: { id: tickerAId } });
  if (tickerBId) await prisma.ticker.delete({ where: { id: tickerBId } });
  if (accountId) await prisma.cashAccount.delete({ where: { id: accountId } });
});

test("naturalKeys limits duplicate preload by ticker and date range", async () => {
  const keys = await investmentTransactionRepository.naturalKeys({
    tickerIds: [tickerAId],
    from: new Date("2024-06-02T00:00:00.000Z"),
    to: new Date("2024-06-02T23:59:59.999Z"),
  });

  const rows = keys
    .filter((key) => [tickerAId, tickerBId].includes(key.tickerId))
    .map((key) => ({
      tickerId: key.tickerId,
      date: key.date.toISOString().slice(0, 10),
      quantity: Number(key.quantity),
    }));

  expect(rows).toEqual([{ tickerId: tickerAId, date: "2024-06-02", quantity: 2 }]);
});
