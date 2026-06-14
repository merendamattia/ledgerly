import Redis from "ioredis";
import { config } from "./config.ts";

// Single Redis connection, reused across hot reloads in development.
const globalForRedis = globalThis as unknown as { redis?: Redis };

export const redis =
  globalForRedis.redis ??
  new Redis(config.REDIS_URL, {
    maxRetriesPerRequest: 3,
    lazyConnect: false,
  });

if (process.env.NODE_ENV !== "production") {
  globalForRedis.redis = redis;
}

const KEY_PREFIX = "ledgerly:";

/**
 * Read a JSON value from the cache. Returns null on miss or parse error.
 */
export async function cacheGet<T>(key: string): Promise<T | null> {
  const raw = await redis.get(KEY_PREFIX + key);
  if (raw === null) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/**
 * Write a JSON value to the cache with an optional TTL (in seconds).
 */
export async function cacheSet(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
  const payload = JSON.stringify(value);
  if (ttlSeconds && ttlSeconds > 0) {
    await redis.set(KEY_PREFIX + key, payload, "EX", ttlSeconds);
  } else {
    await redis.set(KEY_PREFIX + key, payload);
  }
}

/**
 * Delete one or more cache keys.
 */
export async function cacheDel(...keys: string[]): Promise<void> {
  if (keys.length === 0) return;
  await redis.del(...keys.map((k) => KEY_PREFIX + k));
}

/**
 * Invalidate every cache entry matching a glob-style pattern (e.g. "fx:*").
 */
export async function cacheInvalidate(pattern: string): Promise<void> {
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
}
