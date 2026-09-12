import { expect, test } from "bun:test";
import { recoverFinancialAnalysisJobs } from "./financialForecastGeneration.ts";

test("recovery republishes durable forecast and interpretation work with stable job ids", async () => {
  const events: string[] = [];
  const staleBefore = new Date("2026-09-12T06:00:00.000Z");

  const recovered = await recoverFinancialAnalysisJobs({
    staleBefore,
    prepareRecovery: async (receivedCutoff) => {
      expect(receivedCutoff).toEqual(staleBefore);
      return {
        generations: [{ userId: "user-a", generationId: "generation-a" }],
        interpretations: [{ userId: "user-b", snapshotId: "snapshot-b", locale: "it" }],
      };
    },
    enqueueForecast: async (userId, generationId) => {
      events.push(`forecast:${userId}:${generationId}`);
    },
    enqueueInterpretation: async (snapshotId, userId, locale) => {
      events.push(`interpretation:${snapshotId}:${userId}:${locale}`);
    },
  });

  expect(recovered).toEqual({ generations: 1, interpretations: 1 });
  expect(events).toEqual([
    "forecast:user-a:generation-a",
    "interpretation:snapshot-b:user-b:it",
  ]);
});
