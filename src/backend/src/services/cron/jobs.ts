import { tickerRepository } from "../../repositories/ticker.ts";
import { settingsRepository } from "../../repositories/settings.ts";
import { backfillTicker } from "../market/backfill.ts";
import { backfillFx } from "../market/fx.ts";
import { createDailySnapshot } from "../snapshot.ts";

/**
 * Nightly job: for every tracked ticker, fetch the missing daily closes; refresh
 * FX rates for each non-base currency; then record today's net worth snapshot.
 * Returns the number of tickers processed.
 */
export async function runNightlyPrices(): Promise<number> {
  const tickers = await tickerRepository.listAll();

  for (const ticker of tickers) {
    await backfillTicker(ticker, { incremental: true });
  }

  const base = await settingsRepository.baseCurrency();
  const currencies = new Set(tickers.map((t) => t.currency));
  for (const currency of currencies) {
    if (currency !== base) {
      await backfillFx(currency, base, { incremental: true });
    }
  }

  await createDailySnapshot();
  return tickers.length;
}

// Jobs that can be triggered by key via POST /api/cron/:key/run.
export const cronHandlers: Record<string, () => Promise<number>> = {
  "nightly-prices": runNightlyPrices,
};
