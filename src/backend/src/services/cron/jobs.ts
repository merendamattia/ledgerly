import type { Ticker } from "@prisma/client";
import { tickerRepository } from "../../repositories/ticker.ts";
import { providerPriceKey } from "../../repositories/providerPrice.ts";
import { settingsRepository } from "../../repositories/settings.ts";
import { cashAccountRepository } from "../../repositories/cashAccount.ts";
import { debtRepository } from "../../repositories/debt.ts";
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
  const tickers = uniqueProviderTickers(await tickerRepository.listAll());
  for (const ticker of tickers) {
    await backfillTicker(ticker, { incremental: true });
  }
  return tickers.length;
}

/** Full repair backfill: refetches and overwrites stored closes for every provider ticker. */
export async function runFullPriceBackfill(): Promise<number> {
  const tickers = uniqueProviderTickers(await tickerRepository.listAll());
  for (const ticker of tickers) {
    await backfillTicker(ticker, { overwrite: true });
  }
  return tickers.length;
}

/** Keep one backfill source per provider/symbol across all user-owned tickers. */
export function uniqueProviderTickers(tickers: Ticker[]): Ticker[] {
  const seen = new Set<string>();
  return tickers.filter((ticker) => {
    if (ticker.provider === "manual") return false;
    const key = providerPriceKey(ticker);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Build the set of FX pairs to refresh nightly: always EUR/USD (both directions,
 * the reference "fix rate") plus every valuation currency converted to the base
 * currency. Deduped, with same-currency pairs dropped.
 */
export function buildFxPairs(base: string, currencies: string[]): [string, string][] {
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

  // Every valuation currency converted to the base currency.
  for (const currency of currencies) {
    add(currency, base);
  }

  return pairs;
}

/** Combines the currencies that a single user's valuation can require. */
export function collectFxCurrencies(
  tickerCurrencies: string[],
  cashAccountCurrencies: string[],
  debtCurrencies: string[],
): string[] {
  return [...new Set([...tickerCurrencies, ...cashAccountCurrencies, ...debtCurrencies])];
}

/**
 * Nightly FX job: refresh the historical FX rates for every tracked pair
 * (EUR/USD plus each user's valuation currency vs base). Returns the number of pairs processed.
 */
export async function runFxRates(): Promise<number> {
  const pairMap = new Map(
    buildFxPairs("EUR", []).map((pair) => [pair.join(":"), pair] as const),
  );
  const users = await userRepository.listIds();
  const userPairs = await Promise.all(
    users.map(async ({ id }) => {
      const [base, tickers, accounts, debts] = await Promise.all([
        settingsRepository.baseCurrency(id),
        tickerRepository.list(id),
        cashAccountRepository.list(id),
        debtRepository.list(id),
      ]);
      return buildFxPairs(
        base,
        collectFxCurrencies(
          tickers.map((ticker) => ticker.currency),
          accounts.map((account) => account.currency),
          debts.map((debt) => debt.currency),
        ),
      );
    }),
  );
  for (const pairs of userPairs) {
    for (const pair of pairs) {
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
