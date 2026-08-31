import type { Prisma } from "@prisma/client";
import { categoryRepository } from "../repositories/category.ts";
import { transactionRepository } from "../repositories/transaction.ts";
import { normalizeCategoryName } from "../utils/category.ts";
import { importDayRange, isoDay } from "../utils/import-dedupe.ts";

export interface ImportRow {
  direction: "INCOME" | "EXPENSE";
  category?: string | null;
  date: Date;
  amount: number;
  note?: string | null;
}

export interface ImportResult {
  imported: number;
  skipped: number;
  createdCategories: number;
}

/** Stable natural key used to skip duplicates within the batch and against the DB. */
function naturalKey(parts: {
  date: string;
  amount: number;
  direction: string;
  categoryId: string | null;
  note: string | null;
}): string {
  return [
    parts.date,
    parts.amount.toFixed(2),
    parts.direction,
    parts.categoryId ?? "",
    parts.note ?? "",
  ].join("|");
}

export const importService = {
  /**
   * Persist imported transactions. Categories are resolved by exact name+kind
   * (created verbatim when missing); rows duplicating an existing transaction or
   * an earlier row in the same batch are skipped.
   */
  async commit(userId: string, rows: ImportRow[]): Promise<ImportResult> {
    const range = importDayRange(rows.map((row) => row.date));
    if (!range) return { imported: 0, skipped: 0, createdCategories: 0 };

    // 1. Resolve / create categories, caching by `name\x00kind`.
    const categoryCache = new Map(
      (await categoryRepository.list(userId)).map((category) => [
        `${category.name}\0${category.kind}`,
        category.id,
      ]),
    );
    let createdCategories = 0;
    const categoryIdFor = async (
      name: string | null | undefined,
      kind: "INCOME" | "EXPENSE",
    ): Promise<string | null> => {
      if (!name) return null;
      const normalized = normalizeCategoryName(name);
      if (!normalized) return null;
      const cacheKey = `${normalized}\0${kind}`;
      const cached = categoryCache.get(cacheKey);
      if (cached) return cached;
      const existing = await categoryRepository.findByNameKind(userId, normalized, kind);
      const category =
        existing ?? (await categoryRepository.create(userId, { name: normalized, kind }));
      if (!existing) createdCategories++;
      categoryCache.set(cacheKey, category.id);
      return category.id;
    };

    const prepared: Array<{
      date: Date;
      amount: number;
      direction: "INCOME" | "EXPENSE";
      note: string | null;
      categoryId: string | null;
    }> = [];
    for (const row of rows) {
      prepared.push({
        date: row.date,
        amount: row.amount,
        direction: row.direction,
        note: row.note ?? null,
        categoryId: await categoryIdFor(row.category, row.direction),
      });
    }

    // 2. Seed the dedup set from existing transactions in the imported date span.
    const seen = new Set<string>();
    for (const t of await transactionRepository.naturalKeys(userId, range)) {
      seen.add(
        naturalKey({
          date: isoDay(t.date),
          amount: Number(t.amount),
          direction: t.direction,
          categoryId: t.categoryId,
          note: t.note,
        }),
      );
    }

    // 3. Build the insert payload, skipping duplicates.
    const data: Omit<Prisma.TransactionCreateManyInput, "userId">[] = [];
    let skipped = 0;
    for (const row of prepared) {
      const key = naturalKey({
        date: isoDay(row.date),
        amount: row.amount,
        direction: row.direction,
        categoryId: row.categoryId,
        note: row.note,
      });
      if (seen.has(key)) {
        skipped++;
        continue;
      }
      seen.add(key);
      data.push({
        date: row.date,
        amount: row.amount,
        direction: row.direction,
        note: row.note,
        categoryId: row.categoryId,
      });
    }

    if (data.length > 0) await transactionRepository.createMany(userId, data);
    return { imported: data.length, skipped, createdCategories };
  },
};
