import { recurringExpenseRepository } from "../repositories/recurringExpense.ts";
import { investmentTransactionRepository } from "../repositories/investmentTransaction.ts";
import { settingsRepository } from "../repositories/settings.ts";
import { transactionRepository } from "../repositories/transaction.ts";
import { isInvestmentCategoryName } from "../utils/category.ts";
import { computeNextDate } from "./recurring.ts";
import { computeInvestmentHistory } from "./investmentHistory.ts";
import { getFxRateOn } from "./market/fx.ts";
import { computeNetWorthHistory } from "./netWorthHistory.ts";
import { computeNetWorth } from "./valuation.ts";
import {
  FINANCIAL_FORECAST_HORIZON_MONTHS,
  FINANCIAL_FORECAST_LOOKBACK_MONTHS,
  computeFlowAdjustedMonthlyReturns,
  type FinancialForecastInputs,
  type InvestmentReturnSummary,
  type MonthlyAmount,
  type MonthlyObservation,
  type RecurringForecastMonth,
} from "./financialForecast.ts";

const monthKey = (date: Date) =>
  `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-01`;

function monthRange(first: Date, last: Date): string[] {
  const months: string[] = [];
  const cursor = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth(), 1));
  const end = Date.UTC(last.getUTCFullYear(), last.getUTCMonth(), 1);
  while (cursor.getTime() <= end) {
    months.push(monthKey(cursor));
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  return months;
}

function compressMonthEnds<T extends { date: string }>(points: T[]): T[] {
  const ends = new Map<string, T>();
  for (const point of points) ends.set(point.date.slice(0, 7), point);
  return [...ends.values()].sort((a, b) => a.date.localeCompare(b.date));
}

function returnSummary(returns: number[]): InvestmentReturnSummary {
  if (returns.length === 0) {
    return {
      observationMonths: 0,
      cagr: null,
      annualizedArithmeticReturn: null,
      annualizedVolatility: null,
      fallback: "NO_RELIABLE_MARKET_HISTORY",
    };
  }
  const mean = returns.reduce((sum, value) => sum + value, 0) / returns.length;
  const variance =
    returns.reduce((sum, value) => sum + (value - mean) ** 2, 0) / returns.length;
  const compounded = returns.reduce((factor, value) => factor * (1 + value), 1);
  return {
    observationMonths: returns.length,
    cagr: compounded > 0 ? compounded ** (12 / returns.length) - 1 : null,
    annualizedArithmeticReturn: mean * 12,
    annualizedVolatility: Math.sqrt(variance) * Math.sqrt(12),
    fallback: null,
  };
}

type ForecastCashflowTransaction = {
  date: Date;
  direction: "INCOME" | "EXPENSE";
  amount: unknown;
  recurringExpenseId: string | null;
  category?: { name: string } | null;
};

export type InvestmentContributionFlow = {
  date: Date;
  buyAmount: number;
  netAmount: number;
};

export function investmentLedgerContribution(
  transaction: {
    date: Date;
    side: "BUY" | "SELL";
    quantity: unknown;
    price: unknown;
    fee: unknown;
  },
  baseCurrencyRate: number,
): InvestmentContributionFlow {
  const gross = Number(transaction.quantity) * Number(transaction.price);
  const fee = Number(transaction.fee);
  const buyAmount =
    transaction.side === "BUY" ? (gross + fee) * baseCurrencyRate : 0;
  const netAmount =
    transaction.side === "BUY" ? buyAmount : -(gross - fee) * baseCurrencyRate;
  return { date: transaction.date, buyAmount, netAmount };
}

/** Combines categorized transfers with the authoritative investment ledger. */
export function aggregateForecastCashflows(
  transactions: ForecastCashflowTransaction[],
  investmentFlows: InvestmentContributionFlow[],
  cutoff: Date,
) {
  const firstDate = [...transactions, ...investmentFlows]
    .filter(({ date }) => date.getTime() <= cutoff.getTime())
    .reduce<Date | null>((first, row) => (!first || row.date < first ? row.date : first), null);
  if (!firstDate) {
    return {
      observations: [] as MonthlyObservation[],
      income: [] as MonthlyAmount[],
      expenses: [] as MonthlyAmount[],
      contributions: [] as MonthlyAmount[],
    };
  }
  const months = monthRange(firstDate, cutoff);
  const total = new Map(
    months.map((month) => [
      month,
      { income: 0, expenses: 0, investmentContributions: 0 },
    ]),
  );
  const variable = new Map(
    months.map((month) => [
      month,
      { income: 0, expenses: 0, investmentContributions: 0 },
    ]),
  );
  const categorized = new Map(months.map((month) => [month, 0]));
  const variableCategorized = new Map(months.map((month) => [month, 0]));
  const recurringCategorized = new Map(months.map((month) => [month, 0]));
  const ledgerBuys = new Map(months.map((month) => [month, 0]));
  const ledgerNet = new Map(months.map((month) => [month, 0]));
  for (const transaction of transactions) {
    if (transaction.date.getTime() > cutoff.getTime()) continue;
    const key = monthKey(transaction.date);
    const all = total.get(key);
    const stochastic = variable.get(key);
    if (!all || !stochastic) continue;
    const target = transaction.recurringExpenseId ? null : stochastic;
    const investment =
      transaction.direction === "EXPENSE" &&
      isInvestmentCategoryName(transaction.category?.name);
    if (transaction.direction === "INCOME") {
      all.income += Number(transaction.amount);
      if (target) target.income += Number(transaction.amount);
    } else if (investment) {
      const amount = Number(transaction.amount);
      categorized.set(key, categorized.get(key)! + amount);
      if (target) variableCategorized.set(key, variableCategorized.get(key)! + amount);
      else recurringCategorized.set(key, recurringCategorized.get(key)! + amount);
    } else {
      all.expenses += Number(transaction.amount);
      if (target) target.expenses += Number(transaction.amount);
    }
  }
  for (const flow of investmentFlows) {
    if (flow.date.getTime() > cutoff.getTime()) continue;
    const key = monthKey(flow.date);
    if (!ledgerNet.has(key)) continue;
    ledgerBuys.set(key, ledgerBuys.get(key)! + flow.buyAmount);
    ledgerNet.set(key, ledgerNet.get(key)! + flow.netAmount);
  }
  for (const month of months) {
    const buys = ledgerBuys.get(month)!;
    const sells = ledgerNet.get(month)! - buys;
    const totalContributions = ledgerNet.get(month)! + Math.max(0, categorized.get(month)! - buys);
    const unmatchedLedgerBuys = Math.max(0, buys - recurringCategorized.get(month)!);
    const variableContributions =
      sells +
      unmatchedLedgerBuys +
      Math.max(0, variableCategorized.get(month)! - unmatchedLedgerBuys);
    total.get(month)!.investmentContributions = totalContributions;
    variable.get(month)!.investmentContributions = variableContributions;
  }
  const lookback = months.slice(-FINANCIAL_FORECAST_LOOKBACK_MONTHS);
  return {
    observations: lookback.map((month) => ({ month, ...variable.get(month)! })),
    income: months.map((date) => ({ date, value: total.get(date)!.income })),
    expenses: months.map((date) => ({ date, value: total.get(date)!.expenses })),
    contributions: months.map((date) => ({
      date,
      value: total.get(date)!.investmentContributions,
    })),
  };
}

type InvestmentTransactionRow = Awaited<
  ReturnType<typeof investmentTransactionRepository.listAll>
>[number];

async function investmentContributionFlows(
  transactions: InvestmentTransactionRow[],
  baseCurrency: string,
): Promise<InvestmentContributionFlow[]> {
  const rateByCurrencyAndDay = new Map<string, Promise<number>>();
  const rateFor = (currency: string, date: Date) => {
    const key = `${currency}:${date.toISOString().slice(0, 10)}`;
    let rate = rateByCurrencyAndDay.get(key);
    if (!rate) {
      rate = getFxRateOn(currency, baseCurrency, date);
      rateByCurrencyAndDay.set(key, rate);
    }
    return rate;
  };
  return Promise.all(
    transactions.map(async (transaction) => {
      const rate = await rateFor(transaction.ticker.currency, transaction.date);
      return investmentLedgerContribution(transaction, rate);
    }),
  );
}

type RecurringRow = Awaited<ReturnType<typeof recurringExpenseRepository.list>>[number];

function recurringForecast(
  rules: RecurringRow[],
  cutoff: Date,
): RecurringForecastMonth[] {
  const months = Array.from({ length: FINANCIAL_FORECAST_HORIZON_MONTHS }, (_, index) => {
    const date = new Date(Date.UTC(cutoff.getUTCFullYear(), cutoff.getUTCMonth() + index + 1, 1));
    return { month: monthKey(date), income: 0, expenses: 0, investmentContributions: 0 };
  });
  const byMonth = new Map(months.map((month) => [month.month.slice(0, 7), month]));
  const end = new Date(Date.UTC(cutoff.getUTCFullYear(), cutoff.getUTCMonth() + 241, 0));
  for (const rule of rules) {
    if (!rule.enabled) continue;
    let occurrence = new Date(rule.nextRunDate);
    let count = rule.occurrencesCount;
    while (occurrence.getTime() <= end.getTime()) {
      const pastLimit =
        rule.endMode === "AFTER_OCCURRENCES" &&
        rule.maxOccurrences != null &&
        count >= rule.maxOccurrences;
      const pastDate =
        rule.endMode === "ON_DATE" &&
        rule.endDate != null &&
        occurrence.getTime() > rule.endDate.getTime();
      if (pastLimit || pastDate) break;
      if (occurrence.getTime() > cutoff.getTime()) {
        const target = byMonth.get(monthKey(occurrence).slice(0, 7));
        if (target) {
          const value = Number(rule.amount);
          const investment =
            rule.direction === "EXPENSE" && isInvestmentCategoryName(rule.category?.name);
          if (rule.direction === "INCOME") target.income += value;
          else if (investment) target.investmentContributions += value;
          else target.expenses += value;
        }
      }
      count += 1;
      occurrence = computeNextDate(occurrence, rule.intervalUnit, rule.intervalCount);
    }
  }
  return months;
}

/** Loads and aggregates the authoritative persisted inputs for one user. */
export async function loadFinancialForecastInputs(userId: string, cutoff = new Date()) {
  const day = new Date(Date.UTC(cutoff.getUTCFullYear(), cutoff.getUTCMonth(), cutoff.getUTCDate()));
  const [settings, current, netWorthHistory, investmentHistory, transactions, investmentTransactions, recurring] =
    await Promise.all([
      settingsRepository.get(userId),
      computeNetWorth(userId),
      computeNetWorthHistory(userId),
      computeInvestmentHistory(userId),
      transactionRepository.listAll(userId),
      investmentTransactionRepository.listAll(userId),
      recurringExpenseRepository.list(userId),
    ]);
  const contributionFlows = await investmentContributionFlows(
    investmentTransactions,
    settings.baseCurrency,
  );
  const cashflow = aggregateForecastCashflows(transactions, contributionFlows, day);
  const investmentMonthEnds = compressMonthEnds(investmentHistory);
  const investmentReturns = computeFlowAdjustedMonthlyReturns(investmentMonthEnds).slice(
    -FINANCIAL_FORECAST_LOOKBACK_MONTHS,
  );
  const netWorth = compressMonthEnds(netWorthHistory)
    .slice(-24)
    .map((point) => ({ date: point.date, value: point.totalValue }));
  const investments = investmentMonthEnds
    .slice(-24)
    .map((point) => ({ date: point.date, value: point.value }));
  const inputs: FinancialForecastInputs = {
    cutoff: day,
    baseCurrency: settings.baseCurrency,
    current: {
      cash: current.cash,
      credits: current.credits,
      otherAssets: current.otherAssets,
      investments: current.investments,
      debts: current.debts,
      total: current.total,
      allocation: current.allocation,
    },
    monthlyObservations: cashflow.observations,
    recurringFuture: recurringForecast(recurring, day),
    investmentReturns,
    historical: {
      netWorth,
      income: cashflow.income.slice(-24),
      expenses: cashflow.expenses.slice(-24),
      investments,
      contributions: cashflow.contributions.slice(-24),
    },
    investmentReturn: returnSummary(investmentReturns),
  };
  const locale: "en" | "it" = settings.locale === "it" ? "it" : "en";
  return {
    inputs,
    locale,
    effectiveLookbackMonths: Math.min(
      FINANCIAL_FORECAST_LOOKBACK_MONTHS,
      cashflow.observations.length,
    ),
    observationMonths: cashflow.observations.length,
  };
}
