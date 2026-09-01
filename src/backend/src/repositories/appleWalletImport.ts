import type { AppleWalletImportStatus, Prisma, TxDirection } from "@prisma/client";
import { prisma } from "../core/db.ts";

const ACTIVE_FOR_CLAIM: AppleWalletImportStatus[] = ["QUEUED", "RETRYING"];

export const appleWalletImportRepository = {
  async createPending(userId: string, rawPayload: Prisma.InputJsonValue, idempotencyKey: string) {
    const result = await prisma.appleWalletImport.createMany({
      data: { userId, rawPayload, idempotencyKey },
      skipDuplicates: true,
    });
    const record = await prisma.appleWalletImport.findUniqueOrThrow({
      where: { userId_idempotencyKey: { userId, idempotencyKey } },
    });
    return { record, created: result.count === 1 };
  },

  async markQueued(id: string) {
    const now = new Date();
    const result = await prisma.appleWalletImport.updateMany({
      where: { id, status: "PENDING" },
      data: { status: "QUEUED", queueJobId: id, queuedAt: now, lastError: null },
    });
    if (result.count !== 1) throw new Error("Apple Wallet import could not be queued");
    return prisma.appleWalletImport.findUniqueOrThrow({ where: { id } });
  },

  failEnqueue(id: string, error: string) {
    return prisma.appleWalletImport.updateMany({
      where: { id, status: { in: ["PENDING", "QUEUED"] } },
      data: { status: "FAILED", failedAt: new Date(), lastError: error.slice(0, 500) },
    });
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
    input: { date: Date; amount: number; direction: TxDirection; note: string; categoryId: string | null },
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
        },
      });
      if (completed.count !== 1) throw new Error("Apple Wallet import lease was replaced");
      return { transaction, notification };
    });
  },
};
