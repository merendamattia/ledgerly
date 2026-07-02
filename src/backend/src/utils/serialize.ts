import type {
  CashAccount,
  CashSnapshot,
  Category,
  Debt,
  DebtSnapshot,
  Holding,
  InvestmentTransaction,
  RebalanceGroup,
  RecurringExpense,
  Ticker,
  Transaction,
} from "@prisma/client";

/**
 * Serializes a rebalance group, converting Decimal percentages to numbers.
 */
export function serializeRebalanceGroup(g: RebalanceGroup & { members: { tickerId: string }[] }) {
  const { members, ...rest } = g;
  return {
    ...rest,
    targetPct: Number(g.targetPct),
    thresholdPct: Number(g.thresholdPct),
    tickerIds: members.map((m) => m.tickerId),
  };
}

/**
 * Serializes a cash account by converting its Decimal balance to a number.
 */
export function serializeAccount(a: CashAccount) {
  return { ...a, balance: Number(a.balance) };
}

/**
 * Serializes a holding and its optional account relation for JSON responses.
 */
export function serializeHolding(
  h: Holding & { ticker?: Ticker; cashAccount?: CashAccount | null },
) {
  return {
    ...h,
    quantity: Number(h.quantity),
    avgCost: Number(h.avgCost),
    cashAccount: h.cashAccount ? serializeAccount(h.cashAccount) : null,
  };
}

/**
 * Serializes an income/expense transaction by normalizing its amount.
 */
export function serializeTransaction(t: Transaction & { category?: Category | null }) {
  return {
    ...t,
    amount: Number(t.amount),
  };
}

/**
 * Serializes a recurring expense rule by normalizing its amount.
 */
export function serializeRecurringExpense(
  r: RecurringExpense & { category?: Category | null },
) {
  return {
    ...r,
    amount: Number(r.amount),
  };
}

/**
 * Serializes an investment movement and optional cash account relation.
 */
export function serializeInvestmentTransaction(
  t: InvestmentTransaction & { ticker?: Ticker; cashAccount?: CashAccount | null },
) {
  return {
    ...t,
    quantity: Number(t.quantity),
    price: Number(t.price),
    fee: Number(t.fee),
    cashAccount: t.cashAccount ? serializeAccount(t.cashAccount) : null,
  };
}

/**
 * Serializes a dated cash snapshot with an optional account relation.
 */
export function serializeCashSnapshot(s: CashSnapshot & { cashAccount?: CashAccount }) {
  return {
    ...s,
    balance: Number(s.balance),
    cashAccount: s.cashAccount ? serializeAccount(s.cashAccount) : undefined,
  };
}

/**
 * Serializes a debt row by converting its Decimal amount to a number.
 */
export function serializeDebt(d: Debt) {
  return { ...d, amount: Number(d.amount) };
}

/**
 * Serializes a dated debt snapshot with an optional debt relation.
 */
export function serializeDebtSnapshot(s: DebtSnapshot & { debt?: Debt }) {
  return {
    ...s,
    amount: Number(s.amount),
    debt: s.debt ? serializeDebt(s.debt) : undefined,
  };
}
