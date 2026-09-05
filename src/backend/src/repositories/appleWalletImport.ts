import type { AppleWalletImportStatus, Prisma, TxDirection } from "@prisma/client";
import { prisma } from "../core/db.ts";
import type { IntegrationTokenHint } from "../services/appleWalletImport.ts";
import type { WalletAiUsage } from "../services/appleWalletNormalizer.ts";

const ACTIVE_FOR_CLAIM: AppleWalletImportStatus[] = ["QUEUED", "RETRYING"];

export interface AppleWalletImportFilters {
  userId?: string;
  status?: AppleWalletImportStatus;
  from?: Date;
  to?: Date;
  limit?: number;
  offset?: number;
}

const adminUserSelect = {
  id: true,
  name: true,
  email: true,
} as const;

const adminTransactionSelect = {
  id: true,
  date: true,
  amount: true,
  direction: true,
  note: true,
  reviewRequired: true,
  reviewedAt: true,
  category: { select: { id: true, name: true, kind: true, emoji: true } },
} as const;

const adminImportSelect = {
  id: true,
  userId: true,
  status: true,
  attempts: true,
  queuedAt: true,
  startedAt: true,
  completedAt: true,
  failedAt: true,
  lastError: true,
  aiModel: true,
  aiInputTokens: true,
  aiOutputTokens: true,
  aiTotalTokens: true,
  integrationTokenPrefix: true,
  integrationTokenSuffix: true,
  createdAt: true,
  updatedAt: true,
  user: { select: adminUserSelect },
  transaction: { select: adminTransactionSelect },
} as const;

function adminWhere(filters: AppleWalletImportFilters): Prisma.AppleWalletImportWhereInput {
  return {
    userId: filters.userId,
    status: filters.status,
    createdAt:
      filters.from || filters.to
        ? { gte: filters.from, lte: filters.to }
        : undefined,
  };
}

function serializeAdminTransaction<T extends { amount: unknown }>(transaction: T | null) {
  return transaction ? { ...transaction, amount: Number(transaction.amount) } : null;
}

export const appleWalletImportRepository = {
  async createQueued(
    userId: string,
    rawPayload: Prisma.InputJsonValue,
    idempotencyKey: string,
    integrationTokenHint?: IntegrationTokenHint,
  ) {
    const result = await prisma.appleWalletImport.createMany({
      data: {
        userId,
        rawPayload,
        idempotencyKey,
        status: "QUEUED",
        queuedAt: new Date(),
        integrationTokenPrefix: integrationTokenHint?.prefix,
        integrationTokenSuffix: integrationTokenHint?.suffix,
      },
      skipDuplicates: true,
    });
    const record = await prisma.appleWalletImport.findUniqueOrThrow({
      where: { userId_idempotencyKey: { userId, idempotencyKey } },
    });
    return { record, created: result.count === 1 };
  },

  recordEnqueueError(id: string, error: string) {
    return prisma.appleWalletImport.updateMany({
      where: { id, status: "QUEUED" },
      data: { lastError: error.slice(0, 500) },
    });
  },

  queuedForRecovery() {
    return prisma.appleWalletImport.findMany({ where: { status: "QUEUED" }, select: { id: true } });
  },

  async claim(id: string) {
    const now = new Date();
    const staleBefore = new Date(now.getTime() - 30_000);
    const claimed = await prisma.appleWalletImport.updateMany({
      where: {
        id,
        OR: [
          { status: { in: ACTIVE_FOR_CLAIM } },
          { status: "RUNNING", heartbeatAt: { lte: staleBefore } },
        ],
      },
      data: {
        status: "RUNNING",
        startedAt: now,
        heartbeatAt: now,
        failedAt: null,
        lastError: null,
        attempts: { increment: 1 },
      },
    });
    if (claimed.count !== 1) return null;
    return prisma.appleWalletImport.findUnique({
      where: { id },
      include: {
        user: { include: { categories: { orderBy: [{ kind: "asc" }, { name: "asc" }] }, settings: true } },
      },
    });
  },

  heartbeat(id: string, attempt: number) {
    return prisma.appleWalletImport.updateMany({
      where: { id, status: "RUNNING", attempts: attempt },
      data: { heartbeatAt: new Date() },
    });
  },

  retry(id: string, attempt: number, error: string) {
    return prisma.appleWalletImport.updateMany({
      where: { id, status: "RUNNING", attempts: attempt },
      data: { status: "RETRYING", lastError: error.slice(0, 500) },
    });
  },

  fail(id: string, attempt: number, error: string) {
    return prisma.appleWalletImport.updateMany({
      where: { id, status: "RUNNING", attempts: attempt },
      data: {
        status: "FAILED",
        failedAt: new Date(),
        heartbeatAt: new Date(),
        lastError: error.slice(0, 500),
      },
    });
  },

  failStalled(id: string) {
    return prisma.appleWalletImport.updateMany({
      where: { id, status: "RUNNING" },
      data: {
        status: "FAILED",
        failedAt: new Date(),
        heartbeatAt: new Date(),
        lastError: "BullMQ job stalled more than allowable limit",
      },
    });
  },

  async complete(
    id: string,
    attempt: number,
    input: {
      date: Date;
      amount: number;
      direction: TxDirection;
      note: string;
      categoryId: string | null;
      model: string;
      usage: WalletAiUsage;
    },
  ) {
    return prisma.$transaction(async (tx) => {
      const current = await tx.appleWalletImport.findFirst({
        where: { id, status: "RUNNING", attempts: attempt },
      });
      if (!current) return null;

      const transaction = await tx.transaction.create({
        data: {
          userId: current.userId,
          date: input.date,
          amount: input.amount,
          direction: input.direction,
          note: input.note,
          categoryId: input.categoryId,
          reviewRequired: true,
          reviewedAt: null,
        },
        include: { category: true },
      });
      const notification = await tx.notification.create({
        data: {
          userId: current.userId,
          kind: "APPLE_WALLET_IMPORT_COMPLETED",
          transactionId: transaction.id,
        },
      });
      const completed = await tx.appleWalletImport.updateMany({
        where: { id, status: "RUNNING", attempts: attempt },
        data: {
          status: "COMPLETED",
          transactionId: transaction.id,
          completedAt: new Date(),
          heartbeatAt: new Date(),
          lastError: null,
          aiModel: input.model,
          aiInputTokens: input.usage.inputTokens,
          aiOutputTokens: input.usage.outputTokens,
          aiTotalTokens: input.usage.totalTokens,
          normalizedResult: {
            amount: input.amount,
            direction: input.direction,
            date: input.date.toISOString().slice(0, 10),
            note: input.note,
            categoryId: input.categoryId,
          },
        },
      });
      if (completed.count !== 1) throw new Error("Apple Wallet import lease was replaced");
      return { transaction, notification };
    });
  },

  /** Lists Wallet imports for the admin telemetry surface without exposing raw bodies. */
  async listAdmin(filters: AppleWalletImportFilters = {}) {
    const where = adminWhere(filters);
    const [items, total, usage] = await prisma.$transaction([
      prisma.appleWalletImport.findMany({
        where,
        select: adminImportSelect,
        orderBy: [{ createdAt: "desc" }],
        take: filters.limit ?? 25,
        skip: filters.offset ?? 0,
      }),
      prisma.appleWalletImport.count({ where }),
      prisma.appleWalletImport.aggregate({
        where,
        _sum: { aiInputTokens: true, aiOutputTokens: true, aiTotalTokens: true },
      }),
    ]);

    return {
      items: items.map((item) => ({
        ...item,
        transaction: serializeAdminTransaction(item.transaction),
      })),
      total,
      summary: {
        requestCount: total,
        inputTokens: usage._sum.aiInputTokens ?? 0,
        outputTokens: usage._sum.aiOutputTokens ?? 0,
        totalTokens: usage._sum.aiTotalTokens ?? 0,
      },
    };
  },

  /** Loads one admin telemetry detail, including the raw request and AI result. */
  async findAdminById(id: string) {
    const item = await prisma.appleWalletImport.findUnique({
      where: { id },
      select: { ...adminImportSelect, rawPayload: true, normalizedResult: true },
    });
    if (!item) return null;
    return { ...item, transaction: serializeAdminTransaction(item.transaction) };
  },
};
