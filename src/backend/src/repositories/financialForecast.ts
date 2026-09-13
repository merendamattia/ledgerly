import type { Prisma } from "@prisma/client";
import { prisma } from "../core/db.ts";

/** Persistence and guarded state transitions for user-owned forecasts. */
export const financialForecastRepository = {
  async requestGeneration(userId: string, queueJobId: string): Promise<boolean> {
    const rows = await prisma.$queryRaw<{ id: string }[]>`
      INSERT INTO "financial_forecast_state"
        ("id", "userId", "status", "queueJobId", "requestedAt", "updatedAt")
      VALUES
        (${crypto.randomUUID()}, ${userId}, 'PENDING'::"FinancialForecastGenerationStatus", ${queueJobId}, NOW(), NOW())
      ON CONFLICT ("userId") DO UPDATE SET
        "status" = 'PENDING'::"FinancialForecastGenerationStatus",
        "queueJobId" = EXCLUDED."queueJobId",
        "requestedAt" = NOW(),
        "startedAt" = NULL,
        "completedAt" = NULL,
        "failedAt" = NULL,
        "lastError" = NULL,
        "updatedAt" = NOW()
      WHERE "financial_forecast_state"."status" IN (
        'COMPLETED'::"FinancialForecastGenerationStatus",
        'FAILED'::"FinancialForecastGenerationStatus"
      )
      RETURNING "id"
    `;
    return rows.length === 1;
  },

  async recordGenerationEnqueueError(userId: string, queueJobId: string, error: string) {
    await prisma.financialForecastState.updateMany({
      where: { userId, queueJobId, status: "PENDING" },
      data: { lastError: error.slice(0, 500) },
    });
  },

  async claimGeneration(userId: string, queueJobId: string): Promise<boolean> {
    const claimed = await prisma.financialForecastState.updateMany({
      where: { userId, queueJobId, status: "PENDING" },
      data: { status: "RUNNING", startedAt: new Date(), lastError: null },
    });
    return claimed.count === 1;
  },

  async completeGeneration(
    userId: string,
    queueJobId: string,
    snapshot: {
      dataCutoff: Date;
      effectiveLookbackMonths: number;
      observationMonths: number;
      simulationCount: number;
      maxHorizonMonths: number;
      seed: number;
      payload: Prisma.InputJsonValue;
    },
  ) {
    return prisma.$transaction(async (tx) => {
      const analysisQueueJobId = crypto.randomUUID();
      const created = await tx.financialForecastSnapshot.create({
        data: { userId, ...snapshot, analysisQueueJobId },
      });
      const retained = await tx.financialForecastSnapshot.findMany({
        where: { userId },
        orderBy: [{ generatedAt: "desc" }, { id: "desc" }],
        take: 2,
        select: { id: true },
      });
      await tx.financialForecastSnapshot.deleteMany({
        where: { userId, id: { notIn: retained.map(({ id }) => id) } },
      });
      const completed = await tx.financialForecastState.updateMany({
        where: { userId, queueJobId, status: "RUNNING" },
        data: { status: "COMPLETED", completedAt: new Date(), lastError: null },
      });
      if (completed.count !== 1) throw new Error("Forecast generation claim was lost");
      return { ...created, analysisQueueJobId };
    });
  },

  async failGeneration(userId: string, queueJobId: string, error: string) {
    await prisma.financialForecastState.updateMany({
      where: { userId, queueJobId, status: "RUNNING" },
      data: { status: "FAILED", failedAt: new Date(), lastError: error },
    });
  },

  async recoverStaleGenerationClaim(id: string, startedAt: Date): Promise<string | null> {
    const queueJobId = crypto.randomUUID();
    const recovered = await prisma.financialForecastState.updateMany({
      where: { id, status: "RUNNING", startedAt },
      data: {
        status: "PENDING",
        queueJobId,
        startedAt: null,
        failedAt: null,
        lastError: "Financial forecast worker claim expired",
      },
    });
    return recovered.count === 1 ? queueJobId : null;
  },

  async recoverStaleInterpretationClaim(id: string, startedAt: Date): Promise<string | null> {
    const queueJobId = crypto.randomUUID();
    const recovered = await prisma.financialForecastSnapshot.updateMany({
      where: { id, analysisStatus: "RUNNING", analysisStartedAt: startedAt },
      data: {
        analysisStatus: "PENDING",
        analysisQueueJobId: queueJobId,
        analysisStartedAt: null,
        analysisFailedAt: null,
        analysisError: "Financial interpretation worker claim expired",
      },
    });
    return recovered.count === 1 ? queueJobId : null;
  },

  /** Releases expired claims and returns every durable item awaiting delivery. */
  async prepareRecovery(staleBefore: Date) {
    const staleGenerations = await prisma.financialForecastState.findMany({
      where: { status: "RUNNING", startedAt: { lte: staleBefore } },
      select: { id: true, startedAt: true },
    });
    for (const { id, startedAt } of staleGenerations) {
      if (startedAt) await financialForecastRepository.recoverStaleGenerationClaim(id, startedAt);
    }
    const staleInterpretations = await prisma.financialForecastSnapshot.findMany({
      where: { analysisStatus: "RUNNING", analysisStartedAt: { lte: staleBefore } },
      select: { id: true, analysisStartedAt: true },
    });
    for (const { id, analysisStartedAt } of staleInterpretations) {
      if (analysisStartedAt) {
        await financialForecastRepository.recoverStaleInterpretationClaim(id, analysisStartedAt);
      }
    }
    const unassignedInterpretations = await prisma.financialForecastSnapshot.findMany({
      where: { analysisStatus: "PENDING", analysisQueueJobId: null },
      select: { id: true },
    });
    for (const { id } of unassignedInterpretations) {
      await prisma.financialForecastSnapshot.updateMany({
        where: { id, analysisStatus: "PENDING", analysisQueueJobId: null },
        data: { analysisQueueJobId: crypto.randomUUID() },
      });
    }
    const [generationRows, interpretationRows] = await Promise.all([
      prisma.financialForecastState.findMany({
        where: { status: "PENDING", queueJobId: { not: null } },
        orderBy: { requestedAt: "asc" },
        select: { userId: true, queueJobId: true },
      }),
      prisma.financialForecastSnapshot.findMany({
        where: { analysisStatus: "PENDING", analysisQueueJobId: { not: null } },
        orderBy: { generatedAt: "asc" },
        select: {
          id: true,
          userId: true,
          analysisQueueJobId: true,
          user: { select: { settings: { select: { locale: true } } } },
        },
      }),
    ]);
    return {
      generations: generationRows.flatMap(({ userId, queueJobId }) =>
        queueJobId ? [{ userId, generationId: queueJobId }] : [],
      ),
      interpretations: interpretationRows.flatMap(({ id, userId, analysisQueueJobId, user }) =>
        analysisQueueJobId
          ? [{
              userId,
              snapshotId: id,
              queueJobId: analysisQueueJobId,
              locale: user.settings[0]?.locale === "it" ? "it" as const : "en" as const,
            }]
          : [],
      ),
    };
  },

  async latestForUser(userId: string) {
    const [state, snapshot] = await Promise.all([
      prisma.financialForecastState.findUnique({ where: { userId } }),
      prisma.financialForecastSnapshot.findFirst({
        where: { userId },
        orderBy: [{ generatedAt: "desc" }, { id: "desc" }],
      }),
    ]);
    const previousAnalysis =
      snapshot && snapshot.analysisStatus !== "COMPLETED"
        ? await prisma.financialForecastSnapshot.findFirst({
            where: { userId, id: { not: snapshot.id }, analysisStatus: "COMPLETED" },
            orderBy: [{ generatedAt: "desc" }, { id: "desc" }],
            select: { id: true, generatedAt: true, analysisCompletedAt: true, analysisContent: true },
          })
        : null;
    return { state, snapshot, previousAnalysis };
  },

  findSnapshotForUser(userId: string, snapshotId: string) {
    return prisma.financialForecastSnapshot.findFirst({ where: { id: snapshotId, userId } });
  },

  async markAnalysisQueued(snapshotId: string, queueJobId: string) {
    await prisma.financialForecastSnapshot.updateMany({
      where: { id: snapshotId, analysisQueueJobId: queueJobId, analysisStatus: "PENDING" },
      data: { analysisQueuedAt: new Date() },
    });
  },

  async recordAnalysisEnqueueError(snapshotId: string, queueJobId: string, error: string) {
    await prisma.financialForecastSnapshot.updateMany({
      where: { id: snapshotId, analysisQueueJobId: queueJobId, analysisStatus: "PENDING" },
      data: { analysisError: error.slice(0, 500) },
    });
  },

  async claimAnalysis(snapshotId: string, queueJobId: string): Promise<boolean> {
    const claimed = await prisma.financialForecastSnapshot.updateMany({
      where: { id: snapshotId, analysisQueueJobId: queueJobId, analysisStatus: "PENDING" },
      data: { analysisStatus: "RUNNING", analysisStartedAt: new Date(), analysisError: null },
    });
    return claimed.count === 1;
  },

  async completeAnalysis(snapshotId: string, queueJobId: string, content: Prisma.InputJsonValue) {
    const completed = await prisma.financialForecastSnapshot.updateMany({
      where: { id: snapshotId, analysisQueueJobId: queueJobId, analysisStatus: "RUNNING" },
      data: {
        analysisStatus: "COMPLETED",
        analysisContent: content,
        analysisCompletedAt: new Date(),
        analysisError: null,
      },
    });
    if (completed.count !== 1) throw new Error("Financial interpretation claim was lost");
  },

  async failAnalysis(snapshotId: string, queueJobId: string, error: string) {
    await prisma.financialForecastSnapshot.updateMany({
      where: { id: snapshotId, analysisQueueJobId: queueJobId, analysisStatus: "RUNNING" },
      data: { analysisStatus: "FAILED", analysisFailedAt: new Date(), analysisError: error },
    });
  },
};
