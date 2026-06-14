import type { CashAccount, Category, Holding, Ticker, Transaction } from "@prisma/client";

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
