import { Queue } from "bullmq";
import Redis from "ioredis";
import {
  config,
  financialForecastQueueName,
  financialInterpretationQueueName,
} from "./config.ts";
import { logger } from "./logger.ts";

export type FinancialForecastJobData = {
  userId: string;
  generationId: string;
};

export type FinancialInterpretationJobData = {
  userId: string;
  snapshotId: string;
  queueJobId: string;
  locale: "en" | "it";
};

const globalForQueues = globalThis as unknown as {
  financialQueueConnection?: Redis;
  financialForecastQueue?: Queue<FinancialForecastJobData>;
  financialInterpretationQueue?: Queue<FinancialInterpretationJobData>;
};

const connection =
  globalForQueues.financialQueueConnection ??
  new Redis(config.REDIS_URL, { maxRetriesPerRequest: null });

connection.on("error", (error) => {
  logger.warn("Financial analysis queue Redis error", { error: String(error) });
});

export const financialForecastQueue =
  globalForQueues.financialForecastQueue ??
  new Queue<FinancialForecastJobData>(financialForecastQueueName, { connection });

export const financialInterpretationQueue =
  globalForQueues.financialInterpretationQueue ??
  new Queue<FinancialInterpretationJobData>(financialInterpretationQueueName, { connection });

if (process.env.NODE_ENV !== "production") {
  globalForQueues.financialQueueConnection = connection;
  globalForQueues.financialForecastQueue = financialForecastQueue;
  globalForQueues.financialInterpretationQueue = financialInterpretationQueue;
}
