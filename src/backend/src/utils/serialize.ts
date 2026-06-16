import type {
  CashAccount,
  CashSnapshot,
  Category,
  Debt,
  DebtSnapshot,
  Holding,
  InvestmentTransaction,
  Ticker,
  Transaction,
} from "@prisma/client";

// Convert Prisma Decimal fields to plain numbers so JSON responses (and the
// typed RPC client) deal in primitives rather than Decimal instances.

export function serializeAccount(a: CashAccount) {
  return { ...a, balance: Number(a.balance) };
}

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

export function serializeTransaction(t: Transaction & { category?: Category | null }) {
  return {
    ...t,
    amount: Number(t.amount),
  };
}

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

export function serializeCashSnapshot(s: CashSnapshot & { cashAccount?: CashAccount }) {
  return {
    ...s,
    balance: Number(s.balance),
    cashAccount: s.cashAccount ? serializeAccount(s.cashAccount) : undefined,
  };
}

export function serializeDebt(d: Debt) {
  return { ...d, amount: Number(d.amount) };
}

export function serializeDebtSnapshot(s: DebtSnapshot & { debt?: Debt }) {
  return {
    ...s,
    amount: Number(s.amount),
    debt: s.debt ? serializeDebt(s.debt) : undefined,
  };
}
