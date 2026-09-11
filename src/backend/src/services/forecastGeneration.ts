import { ConflictError } from "../core/errors.ts";
import { forecastQueue } from "../core/forecastQueue.ts";
import { userForecastRepository, type PersistedForecast } from "../repositories/userForecast.ts";
import type { ForecastResponse, ForecastSnapshot } from "./forecastContract.ts";
import { buildForecastSnapshot } from "./forecastSnapshot.ts";

type Enqueue = (queueJobId: string) => Promise<unknown>;
type SnapshotBuilder = (userId: string) => Promise<ForecastSnapshot>;

const enqueue: Enqueue = (queueJobId) => forecastQueue.add(
  "generate",
  { queueJobId },
  { jobId: queueJobId, attempts: 1, removeOnComplete: 1_000, removeOnFail: 5_000 },
);

function snapshotOf(record: PersistedForecast | null): ForecastSnapshot | null {
  return record?.payload ? record.payload as unknown as ForecastSnapshot : null;
}

export function forecastResponse(record: PersistedForecast | null): ForecastResponse {
  const snapshot = snapshotOf(record);
  if (!record || record.status === "IDLE") return { status: "EMPTY", snapshot: null };
  if (record.status === "QUEUED" || record.status === "RUNNING") {
    return { status: "GENERATING", snapshot };
  }
  if (record.status === "FAILED") {
    return { status: "FAILED", snapshot, error: record.lastError ?? "Forecast generation failed" };
  }
  if (!snapshot) return { status: "EMPTY", snapshot: null };
  return { status: "READY", snapshot };
}

/** Reads durable state only; no generation or external provider work occurs here. */
export async function readForecast(userId: string): Promise<ForecastResponse> {
  return forecastResponse(await userForecastRepository.find(userId));
}

/** Reserves and enqueues one current-user refresh without executing it inline. */
export async function requestForecastGeneration(userId: string): Promise<ForecastResponse> {
  const queueJobId = await userForecastRepository.reserve(userId);
  if (!queueJobId) throw new ConflictError("A forecast generation is already running");
  try {
    await enqueue(queueJobId);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Forecast queue handoff failed";
    await userForecastRepository.fail(queueJobId, message);
    throw error;
  }
  return readForecast(userId);
}

/** Claims and completes durable forecast work. Only the worker calls this path. */
export async function processForecastGeneration(
  queueJobId: string,
  buildSnapshot: SnapshotBuilder = buildForecastSnapshot,
) {
  const record = await userForecastRepository.claim(queueJobId);
  if (!record) return { skipped: true as const };
  const heartbeat = setInterval(() => {
    void userForecastRepository.heartbeat(queueJobId);
  }, 10_000);
  try {
    const snapshot = await buildSnapshot(record.userId);
    const completed = await userForecastRepository.complete(record.userId, queueJobId, snapshot);
    if (completed.count !== 1) throw new Error("Forecast job lost its durable claim");
    return { skipped: false as const, snapshotId: snapshot.id };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Forecast generation failed";
    await userForecastRepository.fail(queueJobId, message);
    throw error;
  } finally {
    clearInterval(heartbeat);
  }
}

/** Re-publishes queued and expired leased work after a worker or Redis restart. */
export async function recoverForecastGenerations(add: Enqueue = enqueue) {
  const pending = await userForecastRepository.pendingForRecovery();
  await Promise.all(pending.map(({ queueJobId }) => add(queueJobId!)));
  return pending.length;
}
