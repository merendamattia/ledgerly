import { settingsRepository } from "../repositories/settings.ts";
import { cashAccountRepository } from "../repositories/cashAccount.ts";
import { debtRepository } from "../repositories/debt.ts";
import { holdingRepository } from "../repositories/holding.ts";
import { getFxRate } from "./market/fx.ts";
import { latestPrices } from "./market/quotes.ts";

export interface HoldingValuation {
  holdingId: string;
  tickerId: string;
  symbol: string;
  name: string;
  type: string;
  provider: string;
  quantity: number;
  price: number;
  avgCost: number; // per share, ticker currency
  priceDate: string | null;
  currency: string;
  value: number; // in base currency
  cost: number; // in base currency
  gain: number;
  gainPct: number;
}

export interface NetWorth {
  baseCurrency: string;
  cash: number; // LIQUIDITY accounts only
  credits: number; // CREDIT accounts (receivables)
  otherAssets: number; // OTHER_ASSET accounts
  investments: number;
  debts: number;
  total: number;
  allocation: Record<string, number>; // CASH/CREDIT/OTHER_ASSET + per TickerType, in base currency
  holdings: HoldingValuation[];
}

/**
 * Compute the current net worth in the base currency: liquid accounts plus the
 * market value of all holdings. Prices and FX are read cache-first (no provider
 * calls on this path).
 */
export async function computeNetWorth(userId: string): Promise<NetWorth> {
  const [baseCurrency, accounts, holdings, debtRows] = await Promise.all([
    settingsRepository.baseCurrency(userId),
    cashAccountRepository.list(userId),
    holdingRepository.list(userId),
    debtRepository.list(userId),
  ]);

  const currencies = new Set<string>();
  for (const account of accounts) currencies.add(account.currency);
  for (const holding of holdings) currencies.add(holding.ticker.currency);
  for (const debt of debtRows) currencies.add(debt.currency);

  const fxByCurrency = new Map(
    await Promise.all(
      [...currencies].map(async (currency) => [
        currency,
        await getFxRate(currency, baseCurrency),
      ] as const),
    ),
  );

  const quoteByTicker = await latestPrices(holdings.map((holding) => holding.tickerId));

  // Cash accounts converted to base currency, split by category. The account's
  // current cached balance is the live source of truth (snapshots are kept only
  // for history). LIQUIDITY → cash, CREDIT → credits, OTHER_ASSET → otherAssets.
  let cash = 0;
  let credits = 0;
  let otherAssets = 0;
  for (const account of accounts) {
    const fx = fxByCurrency.get(account.currency) ?? 1;
    const value = Number(account.balance) * fx;
    if (account.category === "CREDIT") credits += value;
    else if (account.category === "OTHER_ASSET") otherAssets += value;
    else if (account.type !== "BROKER") cash += value;
  }

  // Holdings valued at latest price, converted to base currency.
  const allocation: Record<string, number> = {
    CASH: cash,
    CREDIT: credits,
    OTHER_ASSET: otherAssets,
  };
  const detail: HoldingValuation[] = [];
  let investments = 0;

  for (const holding of holdings) {
    const quote = quoteByTicker.get(holding.tickerId) ?? null;
    const price = quote?.close ?? 0;
    const fx = fxByCurrency.get(holding.ticker.currency) ?? 1;
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
      provider: holding.ticker.provider,
      quantity,
      price,
      avgCost: Number(holding.avgCost),
      priceDate: quote?.date.toISOString().slice(0, 10) ?? null,
      currency: holding.ticker.currency,
      value,
      cost,
      gain,
      gainPct: cost > 0 ? (gain / cost) * 100 : 0,
    });
  }

  // Debts (liabilities) converted to base currency, subtracted from net worth.
  let debts = 0;
  for (const debt of debtRows) {
    const fx = fxByCurrency.get(debt.currency) ?? 1;
    debts += Number(debt.amount) * fx;
  }

  return {
    baseCurrency,
    cash,
    credits,
    otherAssets,
    investments,
    debts,
    total: cash + credits + otherAssets + investments - debts,
    allocation,
    holdings: detail,
  };
}
