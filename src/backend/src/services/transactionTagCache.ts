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

function cacheKey(filters: TransactionTagFilters): string {
  return [
    "tx-tags",
    dayKey(filters.from),
    dayKey(filters.to),
    filters.direction ?? "",
    filters.categoryId ?? "",
  ].join(":");
}

export function getCachedTransactionTags(filters: TransactionTagFilters) {
  return cacheGet<string[]>(cacheKey(filters));
}

export function cacheTransactionTags(filters: TransactionTagFilters, tags: string[]) {
  return cacheSet(cacheKey(filters), tags, TAG_CACHE_TTL_SECONDS);
}

export function invalidateTransactionTagCache() {
  return cacheInvalidate(TAG_CACHE_PATTERN);
}
