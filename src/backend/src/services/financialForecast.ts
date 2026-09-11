import type { RecurEndMode, RecurInterval, TxDirection } from "@prisma/client";
import { recurringExpenseRepository } from "../repositories/recurringExpense.ts";
import { transactionRepository } from "../repositories/transaction.ts";
import { isInvestmentCategoryName } from "../utils/category.ts";
import { computeCashflowMatrix, type CashflowMatrix } from "./cashflowMatrix.ts";
import {
  computeInvestmentHistory,
  type PortfolioCashFlowEvent,
  type PortfolioPoint,
} from "./investmentHistory.ts";
import { getStoredFxRate } from "./market/fx.ts";
import { latestStoredPrices } from "./market/quotes.ts";
import { computeNetWorthHistory, type NetWorthPoint } from "./netWorthHistory.ts";
import { computeNextDate } from "./recurring.ts";
import { computeNetWorth } from "./valuation.ts";

const DEFAULT_HORIZON_MONTHS = 240;
const DEFAULT_SIMULATIONS = 1_000;
const LOOKBACK_MONTHS = 12;
const MAX_SAFE_VALUE = Number.MAX_SAFE_INTEGER;

export type ReturnFallback =
  | "none"
  | "flat_no_investments"
  | "flat_manual_or_missing_price"
  | "flat_insufficient_history";

export interface MonthlyForecastObservation {
  month: string;
  income: number;
  expense: number;
  contribution: number;
  recurringIncome: number;
  recurringExpense: number;
  recurringContribution: number;
}

export interface FutureRecurringCashFlow {
  month: string;
  income: number;
  expense: number;
  contribution: number;
}

export interface FinancialForecastInput {
  asOf: Date;
  currency: string;
  current: {
    netWorth: number;
    investments: number;
    marketInvestments: number;
    flatInvestments: number;
  };
  observations: MonthlyForecastObservation[];
  recurring: FutureRecurringCashFlow[];
  portfolioReturns: number[];
  portfolioReturnPeriod?: { from: string; to: string } | null;
  returnFallback: ReturnFallback;
  componentAssumptions: string[];
}

export interface PercentilePoint {
  month: string;
  mean: number;
  p10: number;
  p25: number;
  p50: number;
  p75: number;
  p90: number;
}

export interface ForecastSeries {
  netWorth: PercentilePoint[];
  income: PercentilePoint[];
  expense: PercentilePoint[];
  investment: PercentilePoint[];
  contribution: PercentilePoint[];
  return: PercentilePoint[];
  surplus: PercentilePoint[];
}

export interface FinancialForecast {
  status: "ready" | "no_history";
  series: ForecastSeries;
  summary: {
    startingNetWorth: number;
    startingInvestments: number;
    finalNetWorth: PercentilePoint | null;
    finalInvestments: PercentilePoint | null;
    averageMonthlyIncome: number;
    averageMonthlyExpense: number;
    averageMonthlyContribution: number;
  };
  historicalPortfolioReturn: {
    cagr: number;
    annualizedVolatility: number;
    period: { from: string; to: string; months: number };
  } | null;
  assumptions: {
    currency: string;
    observationPeriod: { from: string; to: string } | null;
    observationCount: number;
    effectiveLookbackMonths: number;
    simulationCount: number;
    horizonMonths: number;
    dataQuality: "none" | "reduced" | "standard";
    returnFallback: ReturnFallback;
    contributionTiming: "end_of_month";
    components: string[];
  };
}

interface ForecastTransaction {
  date: Date;
  amount: unknown;
  direction: TxDirection;
  recurringExpenseId?: string | null;
  category?: { name: string } | null;
}

interface LedgerMonthlyMovement {
  amount: number;
  hasActivity: boolean;
  events: PortfolioCashFlowEvent[];
}

interface CashflowObservationSet {
  observations: MonthlyForecastObservation[];
  available: {
    income: boolean;
    expense: boolean;
    contribution: boolean;
  };
}

interface ForecastRecurringRule {
  amount: unknown;
  direction: TxDirection;
  intervalUnit: RecurInterval;
  intervalCount: number;
  nextRunDate: Date;
  endMode: RecurEndMode;
  maxOccurrences: number | null;
  endDate: Date | null;
  occurrencesCount: number;
  enabled: boolean;
  category?: { name: string } | null;
}

interface ForecastNetWorth {
  baseCurrency: string;
  total: number;
  investments: number;
  holdings: { provider: string; priceDate: string | null; value: number }[];
}

export interface ForecastDataSources {
  netWorth(userId: string): Promise<ForecastNetWorth>;
  netWorthHistory(userId: string): Promise<NetWorthPoint[]>;
  cashflow(userId: string): Promise<CashflowMatrix>;
  transactions(userId: string): Promise<ForecastTransaction[]>;
  recurringRules(userId: string): Promise<ForecastRecurringRule[]>;
  investmentHistory(userId: string): Promise<PortfolioPoint[]>;
  investmentLedgerHistory?(userId: string): Promise<PortfolioPoint[]>;
}

export interface ForecastOptions {
  seed?: number;
  random?: () => number;
  simulations?: number;
  horizonMonths?: number;
}

export interface LoadForecastOptions extends ForecastOptions {
  now?: Date;
  sources?: ForecastDataSources;
}

const defaultSources: ForecastDataSources = {
  netWorth: (userId) => computeNetWorth(userId, {
    resolveFxRate: getStoredFxRate,
    resolveLatestPrices: latestStoredPrices,
  }),
  netWorthHistory: (userId) => computeNetWorthHistory(userId, {
    resolveFxRate: getStoredFxRate,
    providerBackedInvestmentsOnly: true,
  }),
  cashflow: computeCashflowMatrix,
  transactions: transactionRepository.listAll,
  recurringRules: recurringExpenseRepository.list,
  investmentHistory: (userId) => computeInvestmentHistory(userId, {
    providerBackedOnly: true,
    resolveFxRate: getStoredFxRate,
  }),
  investmentLedgerHistory: (userId) => computeInvestmentHistory(userId, {
    resolveFxRate: getStoredFxRate,
    includeCashFlowEvents: true,
  }),
};

function safe(value: number): number {
  if (Number.isNaN(value)) return 0;
  if (value === Number.POSITIVE_INFINITY) return MAX_SAFE_VALUE;
  if (value === Number.NEGATIVE_INFINITY) return -MAX_SAFE_VALUE;
  return Math.max(-MAX_SAFE_VALUE, Math.min(MAX_SAFE_VALUE, value));
}

function amount(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

function signedAmount(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? safe(parsed) : 0;
}

function monthKey(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function futureMonth(asOf: Date, offset: number): string {
  return monthKey(new Date(Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth() + offset, 1)));
}

function emptySeries(): ForecastSeries {
  return {
    netWorth: [], income: [], expense: [], investment: [],
    contribution: [], return: [], surplus: [],
  };
}

/** Linear percentile over a finite sample. */
export function percentile(values: number[], probability: number): number {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (sorted.length === 0) return 0;
  const index = Math.max(0, Math.min(1, probability)) * (sorted.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sorted[lower];
  return safe(sorted[lower] + (sorted[upper] - sorted[lower]) * (index - lower));
}

function summarize(month: string, values: number[]): PercentilePoint {
  const finite = values.map(safe);
  return {
    month,
    mean: safe(finite.reduce((sum, value) => safe(sum + value), 0) / finite.length),
    p10: percentile(finite, 0.1),
    p25: percentile(finite, 0.25),
    p50: percentile(finite, 0.5),
    p75: percentile(finite, 0.75),
    p90: percentile(finite, 0.9),
  };
}

function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };
}

function sampledIndex(random: () => number, length: number): number {
  const draw = random();
  const bounded = Number.isFinite(draw) ? Math.max(0, Math.min(0.9999999999999999, draw)) : 0;
  return Math.floor(bounded * length);
}

function historicalReturnSummary(
  rates: number[],
  period?: { from: string; to: string } | null,
): FinancialForecast["historicalPortfolioReturn"] {
  const finite = rates.filter(Number.isFinite).map((rate) => Math.max(-1, Math.min(10, rate)));
  if (finite.length === 0 || finite.some((rate) => rate <= -1)) return null;
  const growth = finite.reduce((product, rate) => product * (1 + rate), 1);
  if (!(growth > 0) || !Number.isFinite(growth)) return null;
  const mean = finite.reduce((sum, rate) => sum + rate, 0) / finite.length;
  const variance = finite.reduce((sum, rate) => sum + (rate - mean) ** 2, 0) / finite.length;
  return {
    cagr: safe(growth ** (12 / finite.length) - 1),
    annualizedVolatility: safe(Math.sqrt(variance) * Math.sqrt(12)),
    period: {
      from: period?.from ?? "unknown",
      to: period?.to ?? "unknown",
      months: finite.length,
    },
  };
}

/**
 * Derives aggregate portfolio returns from monthly market values after removing
 * net external investment flows. Aggregate values inherently retain the user's
 * actual multi-asset allocation rather than substituting a representative ticker.
 */
export function flowAdjustedMonthlyReturns(
  points: PortfolioPoint[],
): { month: string; rate: number }[] {
  const daily = [...points].sort((a, b) => a.date.localeCompare(b.date));
  const monthlyGrowth = new Map<string, number>();
  for (let index = 1; index < daily.length; index++) {
    const opening = safe(daily[index - 1].value);
    if (opening <= 0) continue;
    const flow = safe(cumulativeCashFlow(daily[index]) - cumulativeCashFlow(daily[index - 1]));
    const rawRate = (safe(daily[index].value) - opening - flow) / opening;
    if (!Number.isFinite(rawRate)) continue;
    const month = daily[index].date.slice(0, 7);
    monthlyGrowth.set(month, safe((monthlyGrowth.get(month) ?? 1) * (1 + rawRate)));
  }
  return [...monthlyGrowth.entries()]
    .map(([month, growth]) => ({
      month,
      rate: safe(Math.round((growth - 1) * 1e12) / 1e12),
    }))
    .slice(-LOOKBACK_MONTHS);
}

function cumulativeCashFlow(point: PortfolioPoint): number {
  return safe(point.cashFlow ?? point.invested);
}

function observationAverage(
  observations: MonthlyForecastObservation[],
  field: "income" | "expense" | "contribution",
): number {
  if (observations.length === 0) return 0;
  return safe(observations.reduce((sum, item) => (
    sum + (field === "contribution" ? signedAmount(item[field]) : amount(item[field]))
  ), 0) / observations.length);
}

function applyInvestmentFlow(
  marketInvestments: number,
  flatInvestments: number,
  contribution: number,
): { marketInvestments: number; flatInvestments: number } {
  const market = Math.max(0, safe(marketInvestments));
  const flat = Math.max(0, safe(flatInvestments));
  const flow = safe(contribution);
  if (flow >= 0) {
    return { marketInvestments: safe(market + flow), flatInvestments: flat };
  }

  const total = safe(market + flat);
  const withdrawal = Math.min(total, -flow);
  const marketWithdrawal = Math.min(market, withdrawal);
  const nextMarket = Math.max(0, safe(market - marketWithdrawal));
  const nextFlat = Math.max(0, safe(total - withdrawal - nextMarket));
  return { marketInvestments: nextMarket, flatInvestments: nextFlat };
}

/** Pure seeded Monte Carlo engine. Contributions are added after each month's return. */
export function buildFinancialForecast(
  input: FinancialForecastInput,
  options: ForecastOptions = {},
): FinancialForecast {
  const observations = [...input.observations]
    .sort((a, b) => a.month.localeCompare(b.month))
    .slice(-LOOKBACK_MONTHS);
  const horizonMonths = Math.max(1, Math.floor(options.horizonMonths ?? DEFAULT_HORIZON_MONTHS));
  const simulations = Math.max(1, Math.floor(options.simulations ?? DEFAULT_SIMULATIONS));
  const assumptions: FinancialForecast["assumptions"] = {
    currency: input.currency,
    observationPeriod: observations.length
      ? { from: observations[0].month, to: observations.at(-1)!.month }
      : null,
    observationCount: observations.length,
    effectiveLookbackMonths: observations.length,
    simulationCount: simulations,
    horizonMonths,
    dataQuality: observations.length === 0 ? "none" : observations.length < LOOKBACK_MONTHS ? "reduced" : "standard",
    returnFallback: input.returnFallback,
    contributionTiming: "end_of_month",
    components: [...input.componentAssumptions],
  };
  const baseSummary = {
    startingNetWorth: safe(input.current.netWorth),
    startingInvestments: safe(input.current.investments),
    finalNetWorth: null,
    finalInvestments: null,
    averageMonthlyIncome: observationAverage(observations, "income"),
    averageMonthlyExpense: observationAverage(observations, "expense"),
    averageMonthlyContribution: observationAverage(observations, "contribution"),
  };
  if (observations.length === 0) {
    return {
      status: "no_history",
      series: emptySeries(),
      summary: baseSummary,
      historicalPortfolioReturn: historicalReturnSummary(
        input.portfolioReturns,
        input.portfolioReturnPeriod,
      ),
      assumptions,
    };
  }

  const random = options.random ?? seededRandom(options.seed ?? 0);
  const recurringByMonth = new Map(input.recurring.map((item) => [item.month, item]));
  const usableReturns = input.portfolioReturns
    .filter(Number.isFinite)
    .map((rate) => Math.max(-1, Math.min(10, rate)));
  const marketReturnsEnabled = input.current.marketInvestments > 0;
  const samples = Array.from({ length: horizonMonths }, () => ({
    netWorth: [] as number[], income: [] as number[], expense: [] as number[],
    investment: [] as number[], contribution: [] as number[], return: [] as number[], surplus: [] as number[],
  }));

  for (let simulation = 0; simulation < simulations; simulation++) {
    let marketInvestments = Math.max(0, safe(input.current.marketInvestments));
    let flatInvestments = Math.max(0, safe(input.current.flatInvestments));
    let cumulativeSurplus = 0;
    let cumulativeMarketGain = 0;

    for (let index = 0; index < horizonMonths; index++) {
      const month = futureMonth(input.asOf, index + 1);
      const observed = observations[sampledIndex(random, observations.length)];
      const recurring = recurringByMonth.get(month);
      const residualIncome = Math.max(0, amount(observed.income) - amount(observed.recurringIncome));
      const residualExpense = Math.max(0, amount(observed.expense) - amount(observed.recurringExpense));
      const residualContribution = safe(
        signedAmount(observed.contribution) - amount(observed.recurringContribution),
      );
      const income = safe(residualIncome + amount(recurring?.income));
      const expense = safe(residualExpense + amount(recurring?.expense));
      const contribution = safe(residualContribution + amount(recurring?.contribution));
      const surplus = safe(income - expense);
      const rate = marketReturnsEnabled && marketInvestments > 0 && usableReturns.length
        ? usableReturns[sampledIndex(random, usableReturns.length)]
        : 0;
      const marketGain = safe(marketInvestments * rate);
      marketInvestments = Math.max(0, safe(marketInvestments + marketGain));
      ({ marketInvestments, flatInvestments } = applyInvestmentFlow(
        marketInvestments,
        flatInvestments,
        contribution,
      ));
      cumulativeSurplus = safe(cumulativeSurplus + surplus);
      cumulativeMarketGain = safe(cumulativeMarketGain + marketGain);
      const investment = safe(marketInvestments + flatInvestments);
      const netWorth = safe(
        input.current.netWorth + cumulativeSurplus + cumulativeMarketGain,
      );

      samples[index].income.push(income);
      samples[index].expense.push(expense);
      samples[index].contribution.push(contribution);
      samples[index].surplus.push(surplus);
      samples[index].return.push(rate);
      samples[index].investment.push(investment);
      samples[index].netWorth.push(netWorth);
    }
  }

  const series = emptySeries();
  for (let index = 0; index < horizonMonths; index++) {
    const month = futureMonth(input.asOf, index + 1);
    for (const key of Object.keys(series) as (keyof ForecastSeries)[]) {
      series[key].push(summarize(month, samples[index][key]));
    }
  }

  return {
    status: "ready",
    series,
    summary: {
      ...baseSummary,
      finalNetWorth: series.netWorth.at(-1)!,
      finalInvestments: series.investment.at(-1)!,
    },
    historicalPortfolioReturn: historicalReturnSummary(usableReturns, input.portfolioReturnPeriod),
    assumptions,
  };
}

function rowTotals(matrix: CashflowMatrix, rows: CashflowMatrix["income"]): number[] {
  return matrix.months.map((_, index) => rows.reduce((sum, row) => sum + amount(row.values[index]), 0));
}

function cashflowObservations(
  matrix: CashflowMatrix,
  transactions: ForecastTransaction[],
  investmentHistory: PortfolioPoint[],
): CashflowObservationSet {
  const recurring = new Map<string, { income: number; expense: number; contribution: number }>();
  for (const transaction of transactions) {
    if (!transaction.recurringExpenseId) continue;
    const month = monthKey(transaction.date);
    const totals = recurring.get(month) ?? { income: 0, expense: 0, contribution: 0 };
    const value = amount(transaction.amount);
    if (transaction.direction === "INCOME") totals.income += value;
    else if (isInvestmentCategoryName(transaction.category?.name)) totals.contribution += value;
    else totals.expense += value;
    recurring.set(month, totals);
  }
  const incomes = rowTotals(matrix, matrix.income);
  const expenses = rowTotals(matrix, matrix.expense);
  const contributions = rowTotals(matrix, matrix.investment);
  const matrixIndex = new Map(matrix.months.map((month, index) => [month.slice(0, 7), index]));
  const ledgerContributions = portfolioMonthlyContributions(investmentHistory);
  const months = new Set([...matrixIndex.keys(), ...ledgerContributions.keys()]);
  const categorizedInvestmentTransactions = new Map<string, ForecastTransaction[]>();
  for (const transaction of transactions) {
    if (transaction.direction !== "EXPENSE" || !isInvestmentCategoryName(transaction.category?.name)) continue;
    const month = monthKey(transaction.date);
    const monthTransactions = categorizedInvestmentTransactions.get(month) ?? [];
    monthTransactions.push(transaction);
    categorizedInvestmentTransactions.set(month, monthTransactions);
  }
  return {
    observations: [...months].sort().map((month) => {
      const index = matrixIndex.get(month);
      const known = recurring.get(month) ?? { income: 0, expense: 0, contribution: 0 };
      const cashflowContribution = index == null ? 0 : contributions[index];
      const ledgerContribution = ledgerContributions.get(month);
      return {
        month,
        income: index == null ? 0 : incomes[index],
        expense: index == null ? 0 : expenses[index],
        contribution: reconcileInvestmentContributions(
          cashflowContribution,
          ledgerContribution,
          categorizedInvestmentTransactions.get(month) ?? [],
        ),
        recurringIncome: known.income,
        recurringExpense: known.expense,
        recurringContribution: known.contribution,
      };
    }).slice(-LOOKBACK_MONTHS),
    available: {
      income: matrix.income.length > 0,
      expense: matrix.expense.length > 0,
      contribution: matrix.investment.length > 0
        || [...ledgerContributions.values()].some((movement) => movement.hasActivity),
    },
  };
}

function reconcileInvestmentContributions(
  cashflowContribution: number,
  ledgerContribution: LedgerMonthlyMovement | undefined,
  categorizedTransactions: ForecastTransaction[],
): number {
  if (!ledgerContribution || !ledgerContribution.hasActivity) return cashflowContribution;
  if (categorizedTransactions.length > 0 && ledgerContribution.events.length > 0) {
    const matched = matchCategorizedInvestmentTransactions(categorizedTransactions, ledgerContribution.events);
    return safe(ledgerContribution.amount + cashflowContribution - matched);
  }
  if (ledgerContribution.events.length > 0) {
    return ledgerContribution.events.some((event) => event.side === "BUY")
      ? ledgerContribution.amount
      : safe(cashflowContribution + ledgerContribution.amount);
  }
  // Older callers may provide only aggregate portfolio points. A negative
  // movement is a sale, which the expense-only cash-flow matrix cannot mirror;
  // preserve both sources until callers provide detailed event records.
  return ledgerContribution.amount >= 0
    ? ledgerContribution.amount
    : safe(cashflowContribution + ledgerContribution.amount);
}

function matchCategorizedInvestmentTransactions(
  categorizedTransactions: ForecastTransaction[],
  ledgerEvents: PortfolioCashFlowEvent[],
): number {
  const unmatched = categorizedTransactions.map((transaction) => ({
    transaction,
    matched: false,
  }));
  for (const event of ledgerEvents) {
    if (event.side !== "BUY") continue;
    const candidate = unmatched.find((item) => (
      !item.matched
      && item.transaction.date.toISOString().slice(0, 10) === event.date
      && amountsMatch(amount(item.transaction.amount), event.grossAmount)
    ));
    if (candidate) candidate.matched = true;
  }
  return unmatched.reduce(
    (sum, item) => sum + (item.matched ? amount(item.transaction.amount) : 0),
    0,
  );
}

function amountsMatch(left: number, right: number): boolean {
  return Math.abs(left - right) <= Math.max(0.01, Math.max(Math.abs(left), Math.abs(right)) * 1e-9);
}

function portfolioMonthlyContributions(history: PortfolioPoint[]): Map<string, LedgerMonthlyMovement> {
  const monthEnds = new Map<string, PortfolioPoint>();
  for (const point of history) monthEnds.set(point.date.slice(0, 7), point);
  const contributions = new Map<string, LedgerMonthlyMovement>();
  const hasDetailedEvents = history.some((point) => point.cashFlowEvents !== undefined);
  if (hasDetailedEvents) {
    for (const point of history) {
      const month = point.date.slice(0, 7);
      const movement = contributions.get(month) ?? { amount: 0, hasActivity: false, events: [] };
      const events = point.cashFlowEvents ?? [];
      movement.amount = safe(movement.amount + events.reduce((sum, event) => sum + event.amount, 0));
      movement.hasActivity ||= point.cashFlowActivity === true || events.length > 0;
      movement.events.push(...events);
      contributions.set(month, movement);
    }
    return contributions;
  }

  let previousCashFlow = 0;
  for (const [index, point] of [...monthEnds.values()]
    .sort((a, b) => a.date.localeCompare(b.date))
    .entries()) {
    const cashFlow = cumulativeCashFlow(point);
    const amount = safe(cashFlow - previousCashFlow);
    contributions.set(point.date.slice(0, 7), {
      amount,
      hasActivity: point.cashFlowActivity ?? (amount !== 0 || (index === 0 && cashFlow !== 0)),
      events: [],
    });
    previousCashFlow = cashFlow;
  }
  return contributions;
}

function mergeForecastObservations(
  cashflow: CashflowObservationSet,
  history: MonthlyForecastObservation[],
): MonthlyForecastObservation[] {
  const cashflowByMonth = new Map(cashflow.observations.map((observation) => [observation.month, observation]));
  const historyByMonth = new Map(history.map((observation) => [observation.month, observation]));
  const months = [...new Set([...cashflowByMonth.keys(), ...historyByMonth.keys()])].sort();
  return months.map((month) => {
    const cashflowObservation = cashflowByMonth.get(month);
    const historyObservation = historyByMonth.get(month);
    return {
      month,
      income: cashflow.available.income
        ? cashflowObservation?.income ?? 0
        : historyObservation?.income ?? 0,
      expense: cashflow.available.expense
        ? cashflowObservation?.expense ?? 0
        : historyObservation?.expense ?? 0,
      contribution: cashflow.available.contribution
        ? cashflowObservation?.contribution ?? 0
        : historyObservation?.contribution ?? 0,
      recurringIncome: cashflowObservation?.recurringIncome ?? 0,
      recurringExpense: cashflowObservation?.recurringExpense ?? 0,
      recurringContribution: cashflowObservation?.recurringContribution ?? 0,
    };
  }).slice(-LOOKBACK_MONTHS);
}

function netWorthObservations(history: NetWorthPoint[]): MonthlyForecastObservation[] {
  const monthEnds = new Map<string, NetWorthPoint>();
  for (const point of history) monthEnds.set(point.date.slice(0, 7), point);

  let previousNonInvestmentValue: number | null = null;
  return [...monthEnds.values()]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((point) => {
      const nonInvestmentValue = safe(
        point.cash + point.credits + point.otherAssets - point.debts,
      );
      const change = previousNonInvestmentValue == null
        ? 0
        : safe(nonInvestmentValue - previousNonInvestmentValue);
      previousNonInvestmentValue = nonInvestmentValue;
      return {
        month: point.date.slice(0, 7),
        income: Math.max(0, change),
        expense: Math.max(0, -change),
        contribution: 0,
        recurringIncome: 0,
        recurringExpense: 0,
        recurringContribution: 0,
      };
    })
    .slice(-LOOKBACK_MONTHS);
}

function recurringCashFlow(
  rules: ForecastRecurringRule[],
  now: Date,
  horizonMonths: number,
): FutureRecurringCashFlow[] {
  const totals = new Map<string, FutureRecurringCashFlow>();
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + horizonMonths + 1, 0));
  for (const rule of rules) {
    if (!rule.enabled || rule.intervalCount < 1) continue;
    let date = new Date(rule.nextRunDate);
    let occurrence = rule.occurrencesCount;
    while (date <= end) {
      if (rule.endMode === "ON_DATE" && rule.endDate && date > rule.endDate) break;
      if (rule.endMode === "AFTER_OCCURRENCES" && rule.maxOccurrences != null && occurrence >= rule.maxOccurrences) break;
      if (date > now) {
        const month = monthKey(date);
        const item = totals.get(month) ?? { month, income: 0, expense: 0, contribution: 0 };
        const value = amount(rule.amount);
        if (rule.direction === "INCOME") item.income += value;
        else if (isInvestmentCategoryName(rule.category?.name)) item.contribution += value;
        else item.expense += value;
        totals.set(month, item);
      }
      occurrence++;
      date = computeNextDate(date, rule.intervalUnit, rule.intervalCount);
    }
  }
  return [...totals.values()].sort((a, b) => a.month.localeCompare(b.month));
}

/** Loads user-scoped cached history and executes the pure forecast engine. */
export async function getFinancialForecast(
  userId: string,
  options: LoadForecastOptions = {},
): Promise<FinancialForecast> {
  const sources = options.sources ?? defaultSources;
  const now = options.now ?? new Date();
  const horizonMonths = options.horizonMonths ?? DEFAULT_HORIZON_MONTHS;
  const [netWorth, netWorthHistory, matrix, transactions, recurringRules, investmentHistory, ledgerHistory] = await Promise.all([
    sources.netWorth(userId),
    sources.netWorthHistory(userId),
    sources.cashflow(userId),
    sources.transactions(userId),
    sources.recurringRules(userId),
    sources.investmentHistory(userId),
    sources.investmentLedgerHistory?.(userId),
  ]);
  const marketInvestments = netWorth.holdings
    .filter((holding) => holding.provider !== "manual" && holding.priceDate)
    .reduce((sum, holding) => sum + Math.max(0, safe(holding.value)), 0);
  const flatInvestments = Math.max(0, safe(netWorth.investments - marketInvestments));
  const hasFlatInvestments = netWorth.holdings.some(
    (holding) => holding.provider === "manual" || !holding.priceDate,
  );
  const returnObservations = flowAdjustedMonthlyReturns(investmentHistory);
  const returns = returnObservations.map((item) => item.rate);
  let returnFallback: ReturnFallback = "none";
  if (netWorth.investments <= 0) returnFallback = "flat_no_investments";
  else if (marketInvestments <= 0) returnFallback = "flat_manual_or_missing_price";
  else if (returns.length === 0) returnFallback = "flat_insufficient_history";
  else if (hasFlatInvestments) returnFallback = "flat_manual_or_missing_price";

  const cashFlowObservations = cashflowObservations(matrix, transactions, ledgerHistory ?? investmentHistory);
  const historyObservations = netWorthObservations(netWorthHistory);
  const observations = mergeForecastObservations(cashFlowObservations, historyObservations);
  const usesNetWorthHistory = historyObservations.length > 0 && (
    !cashFlowObservations.available.income || !cashFlowObservations.available.expense
  );
  const componentAssumptions = [
    "cash_surplus_accumulates_in_net_worth",
    "credits_other_assets_and_debts_remain_flat",
    "latest_stored_fx_rates_apply_to_historical_investment_values",
    "forecast_uses_stored_fx_rates_only",
    "missing_stored_fx_rates_use_parity",
    "historical_investment_flows_are_removed_at_month_end",
  ];
  if (netWorthHistory.length === 0) componentAssumptions.push("net_worth_history_unavailable");
  if (usesNetWorthHistory) {
    componentAssumptions.push("net_worth_history_drives_non_investment_surplus");
    componentAssumptions.push("net_worth_history_assumes_investment_flows_and_returns_unavailable");
  }
  if (hasFlatInvestments) componentAssumptions.push("manual_or_unpriced_investments_remain_flat");

  return buildFinancialForecast({
    asOf: now,
    currency: netWorth.baseCurrency,
    current: {
      netWorth: netWorth.total,
      investments: netWorth.investments,
      marketInvestments,
      flatInvestments,
    },
    observations,
    recurring: recurringCashFlow(recurringRules, now, horizonMonths),
    portfolioReturns: returns,
    portfolioReturnPeriod: returnObservations.length
      ? { from: returnObservations[0].month, to: returnObservations.at(-1)!.month }
      : null,
    returnFallback,
    componentAssumptions,
  }, options);
}
