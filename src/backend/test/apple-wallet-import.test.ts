import { afterAll, beforeAll, expect, test } from "bun:test";
import { prisma } from "../src/core/db.ts";
import { appleWalletImportRepository } from "../src/repositories/appleWalletImport.ts";
import { notificationRepository } from "../src/repositories/notification.ts";
import { queueAppleWalletImport, recoverQueuedAppleWalletImports } from "../src/services/appleWalletImport.ts";
import { processAppleWalletImport } from "../src/services/appleWalletWorker.ts";

const suffix = `${Date.now()}-${process.pid}`;
const userId = `wallet-import-${suffix}`;
const otherUserId = `wallet-import-other-${suffix}`;
let categoryId = "";

function walletTelemetry() {
  return {
    model: "gpt-5.6-luna",
    usage: { inputTokens: 101, outputTokens: 23, totalTokens: 124 },
  };
}

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

test("queue handoff persists QUEUED before enqueue and retains work after enqueue failure", async () => {
  const queued = await queueAppleWalletImport(
    userId,
    { merchant: "Queue test", amount: 4.5 },
    undefined,
    async (id) => {
      expect((await prisma.appleWalletImport.findUniqueOrThrow({ where: { id } })).status).toBe("QUEUED");
    },
    { prefix: "ledgerly_ab", suffix: "wxyz" },
  );
  expect(queued.status).toBe("QUEUED");
  const queuedRecord = await prisma.appleWalletImport.findUniqueOrThrow({ where: { id: queued.id } });
  expect(queuedRecord.integrationTokenPrefix).toBe("ledgerly_ab");
  expect(queuedRecord.integrationTokenSuffix).toBe("wxyz");

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
  ).toBe("QUEUED");
});

test("worker recovery republishes imports durable-queued before a process crash", async () => {
  const record = await prisma.appleWalletImport.create({
    data: {
      userId,
      rawPayload: { merchant: "Recover queue" },
      idempotencyKey: `queue-recovery-${suffix}`,
      status: "QUEUED",
      queuedAt: new Date(),
    },
  });
  const recovered: string[] = [];
  await recoverQueuedAppleWalletImports(async (id) => {
    recovered.push(id);
  });
  expect(recovered).toContain(record.id);
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
    ...walletTelemetry(),
  });
  expect(await processAppleWalletImport(record.id, 1, 3, normalize)).toBe("COMPLETED");
  expect(await processAppleWalletImport(record.id, 1, 3, normalize)).toBe("IGNORED");

  const completed = await prisma.appleWalletImport.findUniqueOrThrow({ where: { id: record.id } });
  expect(completed.status).toBe("COMPLETED");
  expect(completed.attempts).toBe(1);
  expect(completed.transactionId).not.toBeNull();
  expect(completed.aiModel).toBe("gpt-5.6-luna");
  expect(completed.aiInputTokens).toBe(101);
  expect(completed.aiOutputTokens).toBe(23);
  expect(completed.aiTotalTokens).toBe(124);
  expect(completed.normalizedResult).toEqual(expect.objectContaining({
    note: "Worker café",
    categoryId,
  }));
  const importedTransaction = await prisma.transaction.findUniqueOrThrow({
    where: { id: completed.transactionId! },
  });
  expect(importedTransaction.reviewRequired).toBe(true);
  expect(importedTransaction.reviewedAt).toBeNull();
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
    processAppleWalletImport(record.id, 1, 3, async ({ onTelemetry }) => {
      // The first AI call was metered but failed before returning a usable result.
      await onTelemetry?.({
        model: "gpt-5.6-luna",
        usage: { inputTokens: 11, outputTokens: 5, totalTokens: 16 },
      });
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
    ...walletTelemetry(),
  }));
  const completed = await prisma.appleWalletImport.findUniqueOrThrow({ where: { id: record.id } });
  expect(completed.status).toBe("COMPLETED");
  expect(completed.attempts).toBe(2);
  expect(completed.aiInputTokens).toBe(112);
  expect(completed.aiOutputTokens).toBe(28);
  expect(completed.aiTotalTokens).toBe(140);
});

test("a metered response that fails after normalization retains usage in the failed aggregate", async () => {
  const originalFetch = globalThis.fetch;
  const originalApiKey = process.env.OPENAI_API_KEY;
  const originalModel = process.env.OPENAI_MODEL;
  const record = await prisma.appleWalletImport.create({
    data: {
      userId,
      rawPayload: { merchant: "Invalid date café", amount: 9 },
      idempotencyKey: `metered-failure-${suffix}`,
      status: "QUEUED",
      queueJobId: `metered-failure-${suffix}`,
      queuedAt: new Date(),
    },
  });

  process.env.OPENAI_API_KEY = "opaque-test-key";
  process.env.OPENAI_MODEL = "configured-wallet-model";
  globalThis.fetch = (async () =>
    new Response(JSON.stringify({
      model: "configured-wallet-model",
      usage: { input_tokens: 41, output_tokens: 17, total_tokens: 58 },
      output: [{
        type: "message",
        content: [{
          type: "output_text",
          text: JSON.stringify({
            amount: 9,
            direction: "EXPENSE",
            date: "2026-99-99",
            note: "Invalid date café",
            categoryId: null,
          }),
        }],
      }],
    }))) as unknown as typeof fetch;

  try {
    await expect(processAppleWalletImport(record.id, 1, 1)).rejects.toThrow(
      "OpenAI returned an invalid transaction date",
    );
    const failed = await prisma.appleWalletImport.findUniqueOrThrow({ where: { id: record.id } });
    expect(failed.status).toBe("FAILED");
    expect(failed.aiModel).toBe("configured-wallet-model");
    expect(failed.aiInputTokens).toBe(41);
    expect(failed.aiOutputTokens).toBe(17);
    expect(failed.aiTotalTokens).toBe(58);

    const aggregate = await appleWalletImportRepository.listAdmin({
      userId,
      status: "FAILED",
      limit: 100,
      offset: 0,
    });
    expect(aggregate.summary).toEqual({
      requestCount: 1,
      inputTokens: 41,
      outputTokens: 17,
      totalTokens: 58,
    });
  } finally {
    globalThis.fetch = originalFetch;
    if (originalApiKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = originalApiKey;
    if (originalModel === undefined) delete process.env.OPENAI_MODEL;
    else process.env.OPENAI_MODEL = originalModel;
  }
});

test("equal-timestamp Wallet requests stay in deterministic order across pages", async () => {
  const createdAt = new Date(Date.now() + 1_000);
  const firstId = `wallet-page-a-${suffix}`;
  const secondId = `wallet-page-b-${suffix}`;
  await prisma.appleWalletImport.createMany({
    data: [
      {
        id: firstId,
        userId,
        rawPayload: { merchant: "Page A" },
        idempotencyKey: `page-a-${suffix}`,
        status: "QUEUED",
        createdAt,
      },
      {
        id: secondId,
        userId,
        rawPayload: { merchant: "Page B" },
        idempotencyKey: `page-b-${suffix}`,
        status: "QUEUED",
        createdAt,
      },
    ],
  });

  const firstPage = await appleWalletImportRepository.listAdmin({
    userId,
    status: "QUEUED",
    limit: 1,
    offset: 0,
  });
  const secondPage = await appleWalletImportRepository.listAdmin({
    userId,
    status: "QUEUED",
    limit: 1,
    offset: 1,
  });
  expect(firstPage.items.map(({ id }) => id)).toEqual([secondId]);
  expect(secondPage.items.map(({ id }) => id)).toEqual([firstId]);
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
    ...walletTelemetry(),
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
