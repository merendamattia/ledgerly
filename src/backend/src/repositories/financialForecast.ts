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
      const created = await tx.financialForecastSnapshot.create({
        data: { userId, ...snapshot },
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
      return created;
    });
  },

  async failGeneration(userId: string, queueJobId: string, error: string) {
    await prisma.financialForecastState.updateMany({
      where: { userId, queueJobId, status: "RUNNING" },
      data: { status: "FAILED", failedAt: new Date(), lastError: error },
    });
  },

  /** Fails expired claims and returns every durable item still awaiting delivery. */
  async prepareRecovery(staleBefore: Date) {
    return prisma.$transaction(async (tx) => {
      await tx.financialForecastState.updateMany({
        where: { status: "RUNNING", startedAt: { lte: staleBefore } },
        data: {
          status: "FAILED",
          failedAt: new Date(),
          lastError: "Financial forecast worker claim expired",
        },
      });
      await tx.financialForecastSnapshot.updateMany({
        where: { analysisStatus: "RUNNING", analysisStartedAt: { lte: staleBefore } },
        data: {
          analysisStatus: "FAILED",
          analysisFailedAt: new Date(),
          analysisError: "Financial interpretation worker claim expired",
        },
      });
      const [generationRows, interpretationRows] = await Promise.all([
        tx.financialForecastState.findMany({
          where: { status: "PENDING", queueJobId: { not: null } },
          orderBy: { requestedAt: "asc" },
          select: { userId: true, queueJobId: true },
        }),
        tx.financialForecastSnapshot.findMany({
          where: { analysisStatus: "PENDING" },
          orderBy: { generatedAt: "asc" },
          select: { id: true, userId: true, user: { select: { settings: { select: { locale: true } } } } },
        }),
      ]);
      return {
        generations: generationRows.flatMap(({ userId, queueJobId }) =>
          queueJobId ? [{ userId, generationId: queueJobId }] : [],
        ),
        interpretations: interpretationRows.map(({ id, userId, user }) => ({
          userId,
          snapshotId: id,
          locale: user.settings[0]?.locale === "it" ? "it" as const : "en" as const,
        })),
      };
    });
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

  async markAnalysisQueued(snapshotId: string) {
    await prisma.financialForecastSnapshot.updateMany({
      where: { id: snapshotId, analysisStatus: "PENDING" },
      data: { analysisQueuedAt: new Date() },
    });
  },

  async recordAnalysisEnqueueError(snapshotId: string, error: string) {
    await prisma.financialForecastSnapshot.updateMany({
      where: { id: snapshotId, analysisStatus: "PENDING" },
      data: { analysisError: error.slice(0, 500) },
    });
  },

  async claimAnalysis(snapshotId: string): Promise<boolean> {
    const claimed = await prisma.financialForecastSnapshot.updateMany({
      where: { id: snapshotId, analysisStatus: "PENDING" },
      data: { analysisStatus: "RUNNING", analysisStartedAt: new Date(), analysisError: null },
    });
    return claimed.count === 1;
  },

  async completeAnalysis(snapshotId: string, content: Prisma.InputJsonValue) {
    await prisma.financialForecastSnapshot.updateMany({
      where: { id: snapshotId, analysisStatus: "RUNNING" },
      data: {
        analysisStatus: "COMPLETED",
        analysisContent: content,
        analysisCompletedAt: new Date(),
        analysisError: null,
      },
    });
  },

  async failAnalysis(snapshotId: string, error: string) {
    await prisma.financialForecastSnapshot.updateMany({
      where: { id: snapshotId, analysisStatus: "RUNNING" },
      data: { analysisStatus: "FAILED", analysisFailedAt: new Date(), analysisError: error },
    });
  },
};
