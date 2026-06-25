import Redis from "ioredis";
import { config } from "./config.ts";
import { logger } from "./logger.ts";

// Single Redis connection, reused across hot reloads in development.
const globalForRedis = globalThis as unknown as {
  redis?: Redis;
  redisErrorListener?: boolean;
};

export const redis =
  globalForRedis.redis ??
  new Redis(config.REDIS_URL, {
    maxRetriesPerRequest: 3,
    lazyConnect: false,
  });

if (process.env.NODE_ENV !== "production") {
  globalForRedis.redis = redis;
}

if (!globalForRedis.redisErrorListener) {
  redis.on("error", (error) => {
    logger.warn("Redis cache error", { error: String(error) });
  });
  globalForRedis.redisErrorListener = true;
}

const KEY_PREFIX = "ledgerly:";

/**
 * Read a JSON value from the cache. Returns null on miss or parse error.
 */
export async function cacheGet<T>(key: string): Promise<T | null> {
  try {
    const raw = await redis.get(KEY_PREFIX + key);
    if (raw === null) return null;
    return JSON.parse(raw) as T;
  } catch (error) {
    logger.warn("Redis cache read skipped", { key, error: String(error) });
    return null;
  }
}

/**
 * Write a JSON value to the cache with an optional TTL (in seconds).
 */
export async function cacheSet(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
  try {
    const payload = JSON.stringify(value);
    if (ttlSeconds && ttlSeconds > 0) {
      await redis.set(KEY_PREFIX + key, payload, "EX", ttlSeconds);
    } else {
      await redis.set(KEY_PREFIX + key, payload);
    }
  } catch (error) {
    logger.warn("Redis cache write skipped", { key, error: String(error) });
  }
}

/**
 * Delete one or more cache keys.
 */
export async function cacheDel(...keys: string[]): Promise<void> {
  if (keys.length === 0) return;
  try {
    await redis.del(...keys.map((k) => KEY_PREFIX + k));
  } catch (error) {
    logger.warn("Redis cache delete skipped", { keys, error: String(error) });
  }
}

/**
 * Invalidate every cache entry matching a glob-style pattern (e.g. "fx:*").
 */
export async function cacheInvalidate(pattern: string): Promise<void> {
  try {
    const stream = redis.scanStream({ match: KEY_PREFIX + pattern, count: 100 });
    const pipeline = redis.pipeline();
    let count = 0;
    for await (const keys of stream) {
      for (const key of keys as string[]) {
        pipeline.del(key);
        count++;
      }
    }
    if (count > 0) await pipeline.exec();
  } catch (error) {
    logger.warn("Redis cache invalidation skipped", { pattern, error: String(error) });
  }
}
