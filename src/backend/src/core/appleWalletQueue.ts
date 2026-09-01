import { Queue } from "bullmq";
import Redis from "ioredis";
import { appleWalletQueueName, config } from "./config.ts";
import { logger } from "./logger.ts";

const globalForQueue = globalThis as unknown as {
  appleWalletQueueConnection?: Redis;
  appleWalletImportQueue?: Queue<AppleWalletJobData>;
};

export type AppleWalletJobData = { importId: string };

const connection =
  globalForQueue.appleWalletQueueConnection ??
  new Redis(config.REDIS_URL, { maxRetriesPerRequest: null });

connection.on("error", (error) => {
  logger.warn("Apple Wallet queue Redis error", { error: String(error) });
});

export const appleWalletImportQueue =
  globalForQueue.appleWalletImportQueue ??
  new Queue<AppleWalletJobData>(appleWalletQueueName, { connection });

if (process.env.NODE_ENV !== "production") {
  globalForQueue.appleWalletQueueConnection = connection;
  globalForQueue.appleWalletImportQueue = appleWalletImportQueue;
}
