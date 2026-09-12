import { createHash, randomUUID } from "node:crypto";
import type { Prisma } from "@prisma/client";
import {
  financialForecastQueue,
  financialInterpretationQueue,
} from "../core/financialAnalysisQueue.ts";
import { logger } from "../core/logger.ts";
import { financialForecastRepository } from "../repositories/financialForecast.ts";
import {
  DEFAULT_FINANCIAL_FORECAST_SIMULATIONS,
  FINANCIAL_FORECAST_HORIZON_MONTHS,
  buildFinancialForecast,
  mulberry32,
} from "./financialForecast.ts";
import { loadFinancialForecastInputs } from "./financialForecastInputs.ts";

type EnqueueForecast = (userId: string, generationId: string) => Promise<unknown>;

const enqueueForecast: EnqueueForecast = (userId, generationId) =>
  financialForecastQueue.add(
    "generate",
    { userId, generationId },
    {
      jobId: generationId,
      attempts: 1,
      removeOnComplete: 500,
      removeOnFail: 2_000,
    },
  );

/** Atomically claims and queues one user refresh; duplicate requests are no-ops. */
export async function queueFinancialForecast(
  userId: string,
  enqueue: EnqueueForecast = enqueueForecast,
) {
  const generationId = randomUUID();
  const requested = await financialForecastRepository.requestGeneration(userId, generationId);
  if (!requested) return { status: "ALREADY_RUNNING" as const };
  try {
    await enqueue(userId, generationId);
    return { status: "QUEUED" as const };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Forecast queue handoff failed";
    await financialForecastRepository.releaseQueuedGeneration(userId, generationId, message);
    throw error;
  }
}

function seedFrom(value: string): number {
  return createHash("sha256").update(value).digest().readUInt32LE(0) & 0x7fffffff;
}

async function queueInterpretation(snapshotId: string, userId: string, locale: "en" | "it") {
  try {
    await financialInterpretationQueue.add(
      "interpret",
      { snapshotId, userId, locale },
      {
        jobId: snapshotId,
        attempts: 1,
        removeOnComplete: 500,
        removeOnFail: 2_000,
      },
    );
    await financialForecastRepository.markAnalysisQueued(snapshotId);
  } catch (error) {
    await financialForecastRepository.failPendingAnalysis(snapshotId, String(error));
    logger.warn("Financial interpretation queue handoff failed", {
      snapshotId,
      userId,
      error: String(error),
    });
  }
}

/** Worker-only forecast calculation and atomic snapshot replacement. */
export async function processFinancialForecast(userId: string, generationId: string) {
  if (!(await financialForecastRepository.claimGeneration(userId, generationId))) {
    return "IGNORED" as const;
  }
  try {
    const loaded = await loadFinancialForecastInputs(userId);
    const seed = seedFrom(`${userId}:${generationId}`);
    const payload = buildFinancialForecast(loaded.inputs, {
      horizonMonths: FINANCIAL_FORECAST_HORIZON_MONTHS,
      simulationCount: DEFAULT_FINANCIAL_FORECAST_SIMULATIONS,
      random: mulberry32(seed),
    });
    const snapshot = await financialForecastRepository.completeGeneration(userId, generationId, {
      dataCutoff: loaded.inputs.cutoff,
      effectiveLookbackMonths: loaded.effectiveLookbackMonths,
      observationMonths: loaded.observationMonths,
      simulationCount: DEFAULT_FINANCIAL_FORECAST_SIMULATIONS,
      maxHorizonMonths: FINANCIAL_FORECAST_HORIZON_MONTHS,
      seed,
      payload: payload as unknown as Prisma.InputJsonValue,
    });
    await queueInterpretation(snapshot.id, userId, loaded.locale);
    return "COMPLETED" as const;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Forecast generation failed";
    await financialForecastRepository.failGeneration(userId, generationId, message);
    throw error;
  }
}
