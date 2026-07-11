import type { Ticker, TickerType } from "@prisma/client";
import { tickerRepository } from "../repositories/ticker.ts";
import { holdingRepository } from "../repositories/holding.ts";
import { investmentTransactionRepository } from "../repositories/investmentTransaction.ts";
import { priceRepository } from "../repositories/price.ts";
import { settingsRepository } from "../repositories/settings.ts";
import { getPriceProvider } from "./market/providers/index.ts";
import { backfillTicker } from "./market/backfill.ts";
import { backfillFx } from "./market/fx.ts";
import { invalidatePrice } from "./market/quotes.ts";
import { runTrackedJob } from "./cron/runner.ts";
import { assertNoInvestmentTransactions } from "./investments.ts";
import { ConflictError, NotFoundError } from "../core/errors.ts";

// Provider name for manually-valued assets (bonds/commodities Yahoo can't price).
const MANUAL_PROVIDER = "manual";

/** Truncate a date to UTC midnight (matches the @db.Date price column). */
function toUtcDate(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

/**
 * Add a new tracked asset: resolve its metadata, create the ticker, then start a
 * full price-history backfill in the background (recorded as a "backfill" cron
 * run so the result is visible in the dashboard).
 */
export async function addAsset(symbol: string, type: TickerType, isin?: string): Promise<Ticker> {
  const provider = getPriceProvider(type);
  const meta = await provider.fetchMeta(symbol);

  // Idempotent: if already tracked, return it (its prices are already backfilled).
  // This lets the "search → select" flow safely (re)resolve a ticker id.
  const existing = await tickerRepository.findBySymbol(meta.symbol);
  if (existing) return existing;

  const ticker = await tickerRepository.create({
    symbol: meta.symbol,
    isin: isin ?? null,
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

/**
 * Add a manually-valued asset (bond/commodity Yahoo can't price). Creates the
 * ticker with the "manual" provider and seeds today's price; no backfill runs.
 */
export async function addManualAsset(input: {
  symbol: string;
  name: string;
  type: TickerType;
  currency: string;
  isin?: string;
  price: number;
}): Promise<Ticker> {
  const existing = await tickerRepository.findBySymbol(input.symbol);
  if (existing) throw new ConflictError("An asset with this symbol is already tracked");

  const ticker = await tickerRepository.create({
    symbol: input.symbol,
    isin: input.isin ?? null,
    name: input.name,
    type: input.type,
    currency: input.currency,
    provider: MANUAL_PROVIDER,
  });

  await priceRepository.upsert(ticker.id, toUtcDate(new Date()), input.price);
  await invalidatePrice(ticker.id);

  // Ensure FX history exists so the holding can be valued in the base currency.
  const base = await settingsRepository.baseCurrency();
  if (ticker.currency !== base) {
    void runTrackedJob("backfill", () => backfillFx(ticker.currency, base), "MANUAL");
  }

  return ticker;
}

/**
 * Set/update the current price of a manually-valued asset (inserts or updates the
 * PriceHistory row for the given day, defaulting to today). Provider-backed assets
 * are priced by the nightly cron and reject manual price edits.
 */
export async function setManualPrice(id: string, price: number, date?: Date): Promise<void> {
  const ticker = await tickerRepository.findById(id);
  if (!ticker) throw new NotFoundError("Asset not found");
  if (ticker.provider !== MANUAL_PROVIDER) {
    throw new ConflictError("Only manually-tracked assets accept a manual price");
  }
  await priceRepository.upsert(id, toUtcDate(date ?? new Date()), price);
  await invalidatePrice(id);
}

/**
 * Seed the price history of an asset that has no pre-purchase history at its earliest
 * transaction date, so a back-dated holding is valued from its purchase date instead of
 * spiking on the day it was added. Without an anchor `computeInvestmentHistory` finds no
 * price ≤ the purchase day and reports 0 until the first tracked price appears.
 *
 * Applies to manual assets (no backfill at all) AND bonds: Yahoo has no historical series
 * for bonds (only a live quote captured nightly from today on), so the pre-tracking window
 * would otherwise read 0. The earliest movement is a BUY, so its `price` is the natural
 * per-unit mark — for a bond that is its clean price (~100 at par), flat until the cron
 * starts recording real closes.
 *
 * Idempotent and cheap: no-op for fully-backfilled provider assets (equity/ETF/crypto/
 * commodity), for assets with no movements, or when a price already exists on/before the
 * earliest movement.
 */
export async function ensurePurchasePriceAnchor(tickerId: string): Promise<void> {
  const ticker = await tickerRepository.findById(tickerId);
  if (!ticker) return;
  const needsAnchor = ticker.provider === MANUAL_PROVIDER || ticker.type === "BOND";
  if (!needsAnchor) return;

  const txs = await investmentTransactionRepository.listByTicker(tickerId); // date asc
  const earliest = txs[0];
  if (!earliest) return;

  const anchorDate = toUtcDate(earliest.date);
  const existing = await priceRepository.onOrBefore(tickerId, anchorDate);
  if (existing) return;

  // No latest-cache invalidation: this only inserts an old historical row.
  await priceRepository.upsert(tickerId, anchorDate, Number(earliest.price));
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
