import { createHash } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { BadRequestError } from "../core/errors.ts";
import { appleWalletImportQueue } from "../core/appleWalletQueue.ts";
import { appleWalletImportRepository } from "../repositories/appleWalletImport.ts";
import { stableJson } from "../utils/stable-json.ts";

type Enqueue = (id: string) => Promise<unknown>;

const enqueue: Enqueue = (id) =>
  appleWalletImportQueue.add(
    "normalize",
    { importId: id },
    {
      jobId: id,
      attempts: 3,
      backoff: { type: "exponential", delay: 2_000 },
      removeOnComplete: 1_000,
      removeOnFail: 5_000,
    },
  );

function idempotencyKey(rawPayload: unknown, header?: string): string {
  const explicit = header?.trim();
  if (explicit && explicit.length > 200) throw new BadRequestError("Idempotency key is too long");
  return createHash("sha256")
    .update(explicit ? `header:${explicit}` : `payload:${stableJson(rawPayload)}`)
    .digest("hex");
}

/** Persists and enqueues one raw Wallet request without executing it inline. */
export async function queueAppleWalletImport(
  userId: string,
  rawPayload: Prisma.InputJsonValue,
  idempotencyHeader?: string,
  add: Enqueue = enqueue,
) {
  const key = idempotencyKey(rawPayload, idempotencyHeader);
  const queued = await appleWalletImportRepository.createQueued(userId, rawPayload, key);
  const record = queued.record;

  try {
    await add(record.id);
    return { id: record.id, status: record.status, duplicate: !queued.created };
  } catch (error) {
    await appleWalletImportRepository.recordEnqueueError(
      record.id,
      error instanceof Error ? error.message : "Queue handoff failed",
    );
    throw error;
  }
}

/** Re-adds durable work left queued across a process restart. */
export async function recoverQueuedAppleWalletImports(add: Enqueue = enqueue) {
  const queued = await appleWalletImportRepository.queuedForRecovery();
  await Promise.all(queued.map(({ id }) => add(id)));
  return queued.length;
}
