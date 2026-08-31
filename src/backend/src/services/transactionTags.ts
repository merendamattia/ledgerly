import type { TransactionFilters } from "../repositories/transaction.ts";
import { transactionRepository } from "../repositories/transaction.ts";
import {
  cacheTransactionTags,
  getCachedTransactionTags,
  invalidateTransactionTagCache,
} from "./transactionTagCache.ts";
import { extractTags } from "../utils/tags.ts";

type TagFilters = Pick<TransactionFilters, "from" | "to" | "categoryId" | "direction">;

export async function listTransactionTags(userId: string, filters: TagFilters = {}): Promise<string[]> {
  const cached = await getCachedTransactionTags(userId, filters);
  if (cached) return cached;

  const seen = new Set<string>();
  const tags: string[] = [];
  for (const row of await transactionRepository.tagNotes(userId, filters)) {
    for (const tag of extractTags(row.note)) {
      const normalized = tag.toLowerCase();
      if (seen.has(normalized)) continue;
      seen.add(normalized);
      tags.push(tag);
    }
  }

  await cacheTransactionTags(userId, filters, tags);
  return tags;
}

export { invalidateTransactionTagCache };
