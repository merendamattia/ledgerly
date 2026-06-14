import { prisma } from "../core/db.ts";
import { settingsRepository } from "../repositories/settings.ts";
import { latestPrice } from "./market/quotes.ts";
import { getFxRate } from "./market/fx.ts";

export interface HoldingValuation {
  holdingId: string;
  tickerId: string;
  symbol: string;
  name: string;
  type: string;
  quantity: number;
  price: number;
  priceDate: string | null;
  currency: string;
  value: number; // in base currency
  cost: number; // in base currency
  gain: number;
  gainPct: number;
}

export interface NetWorth {
  baseCurrency: string;
  cash: number;
  investments: number;
  total: number;
  allocation: Record<string, number>; // CASH + per TickerType, in base currency
  holdings: HoldingValuation[];
}

/**
 * Compute the current net worth in the base currency: liquid accounts plus the
 * market value of all holdings. Prices and FX are read cache-first (no provider
 * calls on this path).
 */
export async function computeNetWorth(): Promise<NetWorth> {
  const baseCurrency = await settingsRepository.baseCurrency();

  // Cash accounts converted to base currency.
  const accounts = await prisma.cashAccount.findMany();
  let cash = 0;
  for (const account of accounts) {
    const fx = await getFxRate(account.currency, baseCurrency);
    cash += Number(account.balance) * fx;
  }

  // Holdings valued at latest price, converted to base currency.
  const holdings = await prisma.holding.findMany({ include: { ticker: true } });
  const allocation: Record<string, number> = { CASH: cash };
  const detail: HoldingValuation[] = [];
  let investments = 0;

  for (const holding of holdings) {
    const quote = await latestPrice(holding.tickerId);
    const price = quote?.close ?? 0;
    const fx = await getFxRate(holding.ticker.currency, baseCurrency);
    const quantity = Number(holding.quantity);
    const value = quantity * price * fx;
    const cost = quantity * Number(holding.avgCost) * fx;
    const gain = value - cost;

    investments += value;
    allocation[holding.ticker.type] = (allocation[holding.ticker.type] ?? 0) + value;

    detail.push({
      holdingId: holding.id,
      tickerId: holding.tickerId,
      symbol: holding.ticker.symbol,
      name: holding.ticker.name,
      type: holding.ticker.type,
      quantity,
      price,
      priceDate: quote?.date.toISOString().slice(0, 10) ?? null,
      currency: holding.ticker.currency,
      value,
      cost,
      gain,
      gainPct: cost > 0 ? (gain / cost) * 100 : 0,
    });
  }

  return {
    baseCurrency,
    cash,
    investments,
    total: cash + investments,
    allocation,
    holdings: detail,
  };
}
