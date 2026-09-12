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
type EnqueueInterpretation = (
  snapshotId: string,
  userId: string,
  locale: "en" | "it",
) => Promise<unknown>;
type PrepareRecovery = typeof financialForecastRepository.prepareRecovery;

const STALE_FINANCIAL_WORKER_CLAIM_MS = 30 * 60 * 1_000;

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

/** Persists one user refresh before best-effort delivery; duplicate requests are no-ops. */
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
    await financialForecastRepository.recordGenerationEnqueueError(userId, generationId, message);
    throw error;
  }
}

function seedFrom(value: string): number {
  return createHash("sha256").update(value).digest().readUInt32LE(0) & 0x7fffffff;
}

const enqueueInterpretation: EnqueueInterpretation = async (snapshotId, userId, locale) => {
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
};

async function queueInterpretation(snapshotId: string, userId: string, locale: "en" | "it") {
  try {
    await enqueueInterpretation(snapshotId, userId, locale);
  } catch (error) {
    await financialForecastRepository.recordAnalysisEnqueueError(snapshotId, String(error));
    logger.warn("Financial interpretation queue handoff failed", {
      snapshotId,
      userId,
      error: String(error),
    });
  }
}

/** Republishes durable outbox rows after the repository expires stale worker claims. */
export async function recoverFinancialAnalysisJobs(options: {
  staleBefore?: Date;
  prepareRecovery?: PrepareRecovery;
  enqueueForecast?: EnqueueForecast;
  enqueueInterpretation?: EnqueueInterpretation;
} = {}) {
  const staleBefore =
    options.staleBefore ?? new Date(Date.now() - STALE_FINANCIAL_WORKER_CLAIM_MS);
  const work = await (options.prepareRecovery ?? financialForecastRepository.prepareRecovery)(
    staleBefore,
  );
  const addForecast = options.enqueueForecast ?? enqueueForecast;
  const addInterpretation = options.enqueueInterpretation ?? enqueueInterpretation;
  let generations = 0;
  let interpretations = 0;
  for (const generation of work.generations) {
    try {
      await addForecast(generation.userId, generation.generationId);
      generations += 1;
    } catch (error) {
      logger.warn("Financial forecast queue recovery failed", {
        generationId: generation.generationId,
        error: String(error),
      });
    }
  }
  for (const interpretation of work.interpretations) {
    try {
      await addInterpretation(
        interpretation.snapshotId,
        interpretation.userId,
        interpretation.locale,
      );
      interpretations += 1;
    } catch (error) {
      logger.warn("Financial interpretation queue recovery failed", {
        snapshotId: interpretation.snapshotId,
        error: String(error),
      });
    }
  }
  return { generations, interpretations };
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
