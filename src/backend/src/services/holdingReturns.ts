import { holdingRepository } from "../repositories/holding.ts";
import { priceRepository } from "../repositories/price.ts";
import { investmentTransactionRepository } from "../repositories/investmentTransaction.ts";
import { latestPrices } from "./market/quotes.ts";

export interface HoldingReturn {
  holdingId: string;
  tickerId: string;
  symbol: string;
  name: string;
  type: string;
  returnPct: number;
}

/**
 * Per-position market return over a window. With `from`, it measures the price
 * change from the latest close on/before `from` to the latest close. Without
 * `from` (the "Max" window) the window starts at each asset's oldest
 * transaction, so it reflects performance since you first bought it. The
 * return % uses the ticker's own currency, so it's FX-neutral as long as that
 * currency is constant — the same assumption the benchmark comparison makes.
 */
export async function computeHoldingReturns(from?: Date): Promise<HoldingReturn[]> {
  const holdings = await holdingRepository.list();
  const latestByTicker = await latestPrices(holdings.map((h) => h.tickerId));
  const out: HoldingReturn[] = [];
  for (const h of holdings) {
    const latest = latestByTicker.get(h.tickerId);
    if (!latest) continue;

    // Max (no `from`) starts at the oldest transaction for this asset.
    let windowStart = from;
    if (!windowStart) {
      const txs = await investmentTransactionRepository.listByTicker(h.tickerId);
      windowStart = txs[0]?.date;
    }

    let baseClose: number | null = null;
    if (windowStart) {
      const base = await priceRepository.onOrBefore(h.tickerId, windowStart);
      baseClose = base ? Number(base.close) : null;
    }
    if (baseClose === null) {
      // No close at/before the window start: fall back to the earliest close.
      const series = await priceRepository.series(h.tickerId);
      baseClose = series[0] ? Number(series[0].close) : null;
    }
    if (baseClose === null || baseClose === 0) continue;

    out.push({
      holdingId: h.id,
      tickerId: h.tickerId,
      symbol: h.ticker.symbol,
      name: h.ticker.name,
      type: h.ticker.type,
      returnPct: (Number(latest.close) / baseClose - 1) * 100,
    });
  }
  return out;
}
