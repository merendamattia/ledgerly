import { Queue } from "bullmq";
import Redis from "ioredis";
import { config, forecastQueueName } from "./config.ts";
import { logger } from "./logger.ts";

export type ForecastJobData = { queueJobId: string };

const globalForQueue = globalThis as unknown as {
  forecastQueueConnection?: Redis;
  forecastQueue?: Queue<ForecastJobData>;
};
const connection =
  globalForQueue.forecastQueueConnection
  ?? new Redis(config.REDIS_URL, { maxRetriesPerRequest: null });

connection.on("error", (error) => {
  logger.warn("Forecast queue Redis error", { error: String(error) });
});

export const forecastQueue =
  globalForQueue.forecastQueue
  ?? new Queue<ForecastJobData>(forecastQueueName, { connection });

if (process.env.NODE_ENV !== "production") {
  globalForQueue.forecastQueueConnection = connection;
  globalForQueue.forecastQueue = forecastQueue;
}
