import type { FinancialForecastPayload } from "./financialForecast.ts";
import { financialForecastRepository } from "../repositories/financialForecast.ts";
import { interpretFinancialForecast } from "./financialInterpretation.ts";

/** Claims and interprets one exact immutable forecast snapshot. */
export async function processFinancialInterpretation(
  snapshotId: string,
  userId: string,
  locale: "en" | "it",
  queueJobId: string,
) {
  if (!(await financialForecastRepository.claimAnalysis(snapshotId, queueJobId))) {
    return "IGNORED" as const;
  }
  try {
    const snapshot = await financialForecastRepository.findSnapshotForUser(userId, snapshotId);
    if (!snapshot) throw new Error("Financial forecast snapshot not found");
    const interpretation = await interpretFinancialForecast({
      userId,
      locale,
      payload: snapshot.payload as unknown as FinancialForecastPayload,
    });
    await financialForecastRepository.completeAnalysis(snapshotId, queueJobId, interpretation);
    return "COMPLETED" as const;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Financial interpretation failed";
    await financialForecastRepository.failAnalysis(snapshotId, queueJobId, message);
    throw error;
  }
}
