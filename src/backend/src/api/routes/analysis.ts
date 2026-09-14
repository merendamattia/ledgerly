import { Hono } from "hono";
import { requireAuth } from "../middlewares/auth.ts";
import type { AppEnv } from "../types.ts";
import type { FinancialForecastPayload } from "../../services/financialForecast.ts";
import { financialForecastRepository } from "../../repositories/financialForecast.ts";
import { queueFinancialForecast } from "../../services/financialForecastGeneration.ts";
import type { FinancialInterpretation } from "../../services/financialInterpretation.ts";

export const analysisRoutes = new Hono<AppEnv>()
  .use("*", requireAuth)
  .get("/", async (c) => {
    const result = await financialForecastRepository.latestForUser(c.get("user").id);
    return c.json({
      generation: result.state
        ? {
            status: result.state.status,
            requestedAt: result.state.requestedAt,
            startedAt: result.state.startedAt,
            completedAt: result.state.completedAt,
            failedAt: result.state.failedAt,
            lastError: result.state.lastError,
          }
        : null,
      forecast: result.snapshot
        ? {
            id: result.snapshot.id,
            generatedAt: result.snapshot.generatedAt,
            dataCutoff: result.snapshot.dataCutoff,
            effectiveLookbackMonths: result.snapshot.effectiveLookbackMonths,
            observationMonths: result.snapshot.observationMonths,
            simulationCount: result.snapshot.simulationCount,
            maxHorizonMonths: result.snapshot.maxHorizonMonths,
            payload: result.snapshot.payload as unknown as FinancialForecastPayload,
            analysis: {
              status: result.snapshot.analysisStatus,
              content: result.snapshot.analysisContent as FinancialInterpretation | null,
              completedAt: result.snapshot.analysisCompletedAt,
            },
          }
        : null,
      previousAnalysis: result.previousAnalysis
        ? {
            snapshotId: result.previousAnalysis.id,
            generatedAt: result.previousAnalysis.generatedAt,
            completedAt: result.previousAnalysis.analysisCompletedAt,
            content: result.previousAnalysis.analysisContent as FinancialInterpretation,
          }
        : null,
    });
  })
  .post("/refresh", async (c) => {
    const result = await queueFinancialForecast(c.get("user").id);
    return c.json(result, 202);
  });
