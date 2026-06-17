import type { Ticker, TickerType } from "@prisma/client";
import { tickerRepository } from "../repositories/ticker.ts";
import { holdingRepository } from "../repositories/holding.ts";
import { settingsRepository } from "../repositories/settings.ts";
import { getPriceProvider } from "./market/providers/index.ts";
import { backfillTicker } from "./market/backfill.ts";
import { backfillFx } from "./market/fx.ts";
import { runTrackedJob } from "./cron/runner.ts";
import { assertNoInvestmentTransactions } from "./investments.ts";
import { ConflictError } from "../core/errors.ts";

/**
 * Add a new tracked asset: resolve its metadata, create the ticker, then start a
 * full price-history backfill in the background (recorded as a "backfill" cron
 * run so the result is visible in the dashboard).
 */
export async function addAsset(symbol: string, type: TickerType): Promise<Ticker> {
  const provider = getPriceProvider(type);
  const meta = await provider.fetchMeta(symbol);

  // Idempotent: if already tracked, return it (its prices are already backfilled).
  // This lets the "search → select" flow safely (re)resolve a ticker id.
  const existing = await tickerRepository.findBySymbol(meta.symbol);
  if (existing) return existing;

  const ticker = await tickerRepository.create({
    symbol: meta.symbol,
    name: meta.name,
    type,
    currency: meta.currency,
    provider: provider.name,
  });

  // Background full backfill (history can be thousands of rows). The cron run
  // captures success/failure so the UI can surface it.
  void runTrackedJob(
    "backfill",
    async () => {
      const inserted = await backfillTicker(ticker);
      const base = await settingsRepository.baseCurrency();
      if (ticker.currency !== base) {
        await backfillFx(ticker.currency, base);
      }
      return inserted;
    },
    "MANUAL",
  );

  return ticker;
}

/** Remove a tracked asset. Fails if any holding or movement still references it. */
export async function removeAsset(id: string): Promise<void> {
  const count = await holdingRepository.countByTicker(id);
  if (count > 0) {
    throw new ConflictError("Cannot delete an asset that still has holdings");
  }
  await assertNoInvestmentTransactions(id);
  await tickerRepository.delete(id);
}
