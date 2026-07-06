import type { InvestmentSide, Prisma } from "@prisma/client";
import { investmentTransactionRepository } from "../repositories/investmentTransaction.ts";
import { importDayRange, isoDay } from "../utils/import-dedupe.ts";
import { recomputeHolding } from "./investments.ts";

export interface InvestmentImportRow {
  tickerId: string;
  cashAccountId: string;
  date: Date;
  side: InvestmentSide;
  quantity: number;
  price: number;
  fee?: number;
  note?: string | null;
}

export interface InvestmentImportResult {
  imported: number;
  skipped: number;
}

/** Stable natural key to skip duplicates within the batch and against the DB. */
function naturalKey(parts: {
  tickerId: string;
  date: string;
  side: string;
  quantity: number;
  price: number;
}): string {
  return [
    parts.tickerId,
    parts.date,
    parts.side,
    parts.quantity.toFixed(10),
    parts.price.toFixed(8),
  ].join("|");
}

export const investmentImportService = {
  /**
   * Bulk-insert mapped investment movements, skipping rows that duplicate an
   * existing movement or an earlier row in the same batch, then recompute the
   * affected holdings once per distinct ticker.
   */
  async commit(rows: InvestmentImportRow[]): Promise<InvestmentImportResult> {
    const range = importDayRange(rows.map((row) => row.date));
    if (!range) return { imported: 0, skipped: 0 };

    // Seed the dedup set from existing movements in the imported date/ticker span.
    const seen = new Set<string>();
    const tickerIds = [...new Set(rows.map((row) => row.tickerId))];
    for (const t of await investmentTransactionRepository.naturalKeys({ ...range, tickerIds })) {
      seen.add(
        naturalKey({
          tickerId: t.tickerId,
          date: isoDay(t.date),
          side: t.side,
          quantity: Number(t.quantity),
          price: Number(t.price),
        }),
      );
    }

    // Build the insert payload, skipping duplicates and tracking touched tickers.
    const data: Prisma.InvestmentTransactionCreateManyInput[] = [];
    const touched = new Set<string>();
    let skipped = 0;
    for (const row of rows) {
      const key = naturalKey({
        tickerId: row.tickerId,
        date: isoDay(row.date),
        side: row.side,
        quantity: row.quantity,
        price: row.price,
      });
      if (seen.has(key)) {
        skipped++;
        continue;
      }
      seen.add(key);
      touched.add(row.tickerId);
      data.push({
        tickerId: row.tickerId,
        cashAccountId: row.cashAccountId,
        date: row.date,
        side: row.side,
        quantity: row.quantity,
        price: row.price,
        fee: row.fee ?? 0,
        note: row.note ?? null,
      });
    }

    if (data.length > 0) {
      await investmentTransactionRepository.createMany(data);
      await Promise.all([...touched].map((tickerId) => recomputeHolding(tickerId)));
    }

    return { imported: data.length, skipped };
  },
};
