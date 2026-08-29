import { tickerRepository } from "../../repositories/ticker.ts";
import { settingsRepository } from "../../repositories/settings.ts";
import { backfillTicker } from "../market/backfill.ts";
import { backfillFx } from "../market/fx.ts";
import { createDailySnapshot, createDailyBalanceSnapshots } from "../snapshot.ts";
import { generateDue } from "../recurring.ts";
import { userRepository } from "../../repositories/user.ts";

/**
 * Nightly price job: for every tracked ticker, fetch the missing daily closes.
 * Returns the number of tickers processed.
 */
export async function runNightlyPrices(): Promise<number> {
  // Manually-valued assets (provider "manual") have no external source — their
  // prices are entered by the user, so skip them here.
  const tickers = (await tickerRepository.listAll()).filter((t) => t.provider !== "manual");
  for (const ticker of tickers) {
    await backfillTicker(ticker, { incremental: true });
  }
  return tickers.length;
}

/** Full repair backfill: refetches and overwrites stored closes for every provider ticker. */
export async function runFullPriceBackfill(): Promise<number> {
  const tickers = (await tickerRepository.listAll()).filter((t) => t.provider !== "manual");
  for (const ticker of tickers) {
    await backfillTicker(ticker, { overwrite: true });
  }
  return tickers.length;
}

/**
 * Build the set of FX pairs to refresh nightly: always EUR/USD (both directions,
 * the reference "fix rate") plus every ticker currency converted to the base
 * currency. Deduped, with same-currency pairs dropped.
 */
export function buildFxPairs(base: string, tickerCurrencies: string[]): [string, string][] {
  const seen = new Set<string>();
  const pairs: [string, string][] = [];
  const add = (b: string, q: string) => {
    if (b === q) return;
    const key = `${b}:${q}`;
    if (seen.has(key)) return;
    seen.add(key);
    pairs.push([b, q]);
  };

  // Guaranteed reference pair, independent of holdings.
  add("EUR", "USD");
  add("USD", "EUR");

  // Every holding currency valued against the base currency.
  for (const currency of tickerCurrencies) {
    add(currency, base);
  }

  return pairs;
}

/**
 * Nightly FX job: refresh the historical FX rates for every tracked pair
 * (EUR/USD plus each holding currency vs base). Returns the number of pairs processed.
 */
export async function runFxRates(): Promise<number> {
  const [users, tickers] = await Promise.all([userRepository.listIds(), tickerRepository.listAll()]);
  const bases = await Promise.all(users.map((user) => settingsRepository.baseCurrency(user.id)));
  const pairMap = new Map(
    buildFxPairs("EUR", []).map((pair) => [pair.join(":"), pair] as const),
  );
  for (const base of bases) {
    for (const pair of buildFxPairs(base, tickers.map((ticker) => ticker.currency))) {
      pairMap.set(pair.join(":"), pair);
    }
  }
  const pairs = [...pairMap.values()];

  for (const [b, q] of pairs) {
    await backfillFx(b, q, { incremental: true });
  }
  return pairs.length;
}

/**
 * Nightly snapshot job: record today's cash and debt balances, then the net worth
 * snapshot. Runs after the price/FX jobs so it reads fresh data. Returns the number
 * of snapshot groups written (balances + net worth).
 */
export async function runSnapshots(): Promise<number> {
  const users = await userRepository.listIds();
  await Promise.all(
    users.map(async ({ id }) => {
      await createDailyBalanceSnapshots(id);
      await createDailySnapshot(id);
    }),
  );
  return users.length;
}

/**
 * Recurring-expenses job: book a movement for every due occurrence of every
 * enabled recurring rule. Returns the number of movements created.
 */
export async function runRecurring(): Promise<number> {
  const users = await userRepository.listIds();
  const counts = await Promise.all(users.map(({ id }) => generateDue(id, new Date())));
  return counts.reduce((total, count) => total + count, 0);
}

// Jobs that can be triggered by key via POST /api/cron/:key/run.
export const cronHandlers: Record<string, () => Promise<number>> = {
  "nightly-prices": runNightlyPrices,
  backfill: runFullPriceBackfill,
  "fx-rates": runFxRates,
  snapshots: runSnapshots,
  "recurring-expenses": runRecurring,
};
