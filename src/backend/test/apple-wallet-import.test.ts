import { afterAll, beforeAll, expect, test } from "bun:test";
import { prisma } from "../src/core/db.ts";
import { notificationRepository } from "../src/repositories/notification.ts";
import { queueAppleWalletImport } from "../src/services/appleWalletImport.ts";
import { processAppleWalletImport } from "../src/services/appleWalletWorker.ts";

const suffix = `${Date.now()}-${process.pid}`;
const userId = `wallet-import-${suffix}`;
const otherUserId = `wallet-import-other-${suffix}`;
let categoryId = "";

beforeAll(async () => {
  await prisma.user.create({
    data: {
      id: userId,
      name: "Wallet Import Owner",
      email: `${userId}@example.com`,
      settings: { create: { baseCurrency: "EUR" } },
    },
  });
  await prisma.user.create({
    data: {
      id: otherUserId,
      name: "Other Wallet User",
      email: `${otherUserId}@example.com`,
      settings: { create: { baseCurrency: "EUR" } },
    },
  });
  categoryId = (
    await prisma.category.create({
      data: { userId, name: "Eating out", kind: "EXPENSE" },
    })
  ).id;
});

afterAll(async () => {
  await prisma.user.delete({ where: { id: userId } }).catch(() => undefined);
  await prisma.user.delete({ where: { id: otherUserId } }).catch(() => undefined);
});

test("queue handoff persists QUEUED before enqueue and records enqueue failure", async () => {
  const queued = await queueAppleWalletImport(
    userId,
    { merchant: "Queue test", amount: 4.5 },
    undefined,
    async (id) => {
      expect((await prisma.appleWalletImport.findUniqueOrThrow({ where: { id } })).status).toBe("QUEUED");
    },
  );
  expect(queued.status).toBe("QUEUED");

  await expect(
    queueAppleWalletImport(
      userId,
      { merchant: "Queue failure", amount: 7 },
      undefined,
      async () => {
        throw new Error("Redis unavailable");
      },
    ),
  ).rejects.toThrow("Redis unavailable");
  expect(
    (
      await prisma.appleWalletImport.findFirstOrThrow({
        where: { userId, rawPayload: { equals: { merchant: "Queue failure", amount: 7 } } },
      })
    ).status,
  ).toBe("FAILED");
});

test("worker creates one transaction and notification and ignores duplicate delivery", async () => {
  const record = await prisma.appleWalletImport.create({
    data: {
      userId,
      rawPayload: { merchant: "Worker café", amount: "12.50 EUR" },
      idempotencyKey: `worker-${suffix}`,
      status: "QUEUED",
      queueJobId: `worker-${suffix}`,
      queuedAt: new Date(),
    },
  });

  const normalize = async () => ({
    amount: 12.5,
    direction: "EXPENSE" as const,
    date: "2026-09-01",
    note: "Worker café",
    categoryId,
  });
  expect(await processAppleWalletImport(record.id, 1, 3, normalize)).toBe("COMPLETED");
  expect(await processAppleWalletImport(record.id, 1, 3, normalize)).toBe("IGNORED");

  const completed = await prisma.appleWalletImport.findUniqueOrThrow({ where: { id: record.id } });
  expect(completed.status).toBe("COMPLETED");
  expect(completed.attempts).toBe(1);
  expect(completed.transactionId).not.toBeNull();
  expect(await prisma.transaction.count({ where: { userId, note: "Worker café" } })).toBe(1);
  expect(
    await prisma.notification.count({
      where: { userId, transactionId: completed.transactionId, kind: "APPLE_WALLET_IMPORT_COMPLETED" },
    }),
  ).toBe(1);
});

test("worker records retry state before a later successful attempt", async () => {
  const record = await prisma.appleWalletImport.create({
    data: {
      userId,
      rawPayload: { merchant: "Retry café", amount: 3 },
      idempotencyKey: `retry-${suffix}`,
      status: "QUEUED",
      queueJobId: `retry-${suffix}`,
      queuedAt: new Date(),
    },
  });

  await expect(
    processAppleWalletImport(record.id, 1, 3, async () => {
      throw new Error("temporary OpenAI failure");
    }),
  ).rejects.toThrow("temporary OpenAI failure");
  expect((await prisma.appleWalletImport.findUniqueOrThrow({ where: { id: record.id } })).status).toBe("RETRYING");

  await processAppleWalletImport(record.id, 2, 3, async () => ({
    amount: 3,
    direction: "EXPENSE",
    date: "2026-09-01",
    note: "Retry café",
    categoryId,
  }));
  const completed = await prisma.appleWalletImport.findUniqueOrThrow({ where: { id: record.id } });
  expect(completed.status).toBe("COMPLETED");
  expect(completed.attempts).toBe(2);
});

test("worker reclaims a stale RUNNING lease after a crash", async () => {
  const record = await prisma.appleWalletImport.create({
    data: {
      userId,
      rawPayload: { merchant: "Recovered café", amount: 5 },
      idempotencyKey: `stalled-${suffix}`,
      status: "RUNNING",
      queueJobId: `stalled-${suffix}`,
      attempts: 1,
      startedAt: new Date(Date.now() - 60_000),
      heartbeatAt: new Date(Date.now() - 60_000),
    },
  });

  await processAppleWalletImport(record.id, 1, 3, async () => ({
    amount: 5,
    direction: "EXPENSE",
    date: "2026-09-01",
    note: "Recovered café",
    categoryId,
  }));
  const completed = await prisma.appleWalletImport.findUniqueOrThrow({ where: { id: record.id } });
  expect(completed.status).toBe("COMPLETED");
  expect(completed.attempts).toBe(2);
  expect(await prisma.transaction.count({ where: { userId, note: "Recovered café" } })).toBe(1);
});

test("notifications cannot be listed or marked read across users", async () => {
  const transaction = await prisma.transaction.create({
    data: { userId, date: new Date(), amount: 1, direction: "EXPENSE", note: "Private notification" },
  });
  const notification = await prisma.notification.create({
    data: { userId, kind: "APPLE_WALLET_IMPORT_COMPLETED", transactionId: transaction.id },
  });

  expect((await notificationRepository.list(otherUserId)).items).toHaveLength(0);
  expect((await notificationRepository.markRead(otherUserId, notification.id)).count).toBe(0);
  expect((await prisma.notification.findUniqueOrThrow({ where: { id: notification.id } })).readAt).toBeNull();
});
