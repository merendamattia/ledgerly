import type { InvestmentSide, Prisma } from "@prisma/client";
import { investmentTransactionRepository } from "../repositories/investmentTransaction.ts";
import { cashAccountRepository } from "../repositories/cashAccount.ts";
import { tickerRepository } from "../repositories/ticker.ts";
import { importDayRange, isoDay } from "../utils/import-dedupe.ts";
import { recomputeHolding } from "./investments.ts";
import { NotFoundError } from "../core/errors.ts";

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
  async commit(userId: string, rows: InvestmentImportRow[]): Promise<InvestmentImportResult> {
    const range = importDayRange(rows.map((row) => row.date));
    if (!range) return { imported: 0, skipped: 0 };

    // Seed the dedup set from existing movements in the imported date/ticker span.
    const seen = new Set<string>();
    const tickerIds = [...new Set(rows.map((row) => row.tickerId))];
    const ownedTickers = await tickerRepository.list(userId);
    const ownedTickerIds = new Set(ownedTickers.map((ticker) => ticker.id));
    const ownedAccounts = await cashAccountRepository.list(userId);
    const ownedAccountIds = new Set(ownedAccounts.map((account) => account.id));
    if (tickerIds.some((tickerId) => !ownedTickerIds.has(tickerId))) {
      throw new NotFoundError("One or more assets were not found");
    }
    if (rows.some((row) => !ownedAccountIds.has(row.cashAccountId))) {
      throw new NotFoundError("One or more cash accounts were not found");
    }
    for (const t of await investmentTransactionRepository.naturalKeys(userId, { ...range, tickerIds })) {
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
    const data: Omit<Prisma.InvestmentTransactionCreateManyInput, "userId">[] = [];
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
      await investmentTransactionRepository.createMany(userId, data);
      await Promise.all([...touched].map((tickerId) => recomputeHolding(userId, tickerId)));
    }

    return { imported: data.length, skipped };
  },
};
