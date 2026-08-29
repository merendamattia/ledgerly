import { cacheGet, cacheInvalidate, cacheSet } from "../core/redis.ts";

const TAG_CACHE_TTL_SECONDS = 60 * 5;
const TAG_CACHE_PATTERN = "tx-tags:*";

export interface TransactionTagFilters {
  from?: Date;
  to?: Date;
  categoryId?: string;
  direction?: "INCOME" | "EXPENSE";
}

function dayKey(date?: Date): string {
  return date ? date.toISOString().slice(0, 10) : "";
}

function cacheKey(userId: string, filters: TransactionTagFilters): string {
  return [
    "tx-tags",
    userId,
    dayKey(filters.from),
    dayKey(filters.to),
    filters.direction ?? "",
    filters.categoryId ?? "",
  ].join(":");
}

export function getCachedTransactionTags(userId: string, filters: TransactionTagFilters) {
  return cacheGet<string[]>(cacheKey(userId, filters));
}

export function cacheTransactionTags(userId: string, filters: TransactionTagFilters, tags: string[]) {
  return cacheSet(cacheKey(userId, filters), tags, TAG_CACHE_TTL_SECONDS);
}

export function invalidateTransactionTagCache() {
  return cacheInvalidate(TAG_CACHE_PATTERN);
}
