"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import type { Period } from "./periods";

type PeriodState = { period: Period; setPeriod: (p: Period) => void };

const PeriodContext = createContext<PeriodState | null>(null);

// Cashflow period selection, lifted to the app shell so the topbar can own the
// picker (next to "+ Add expense") while the page reads the value. Mirrors
// SearchProvider. Transient, not persisted.
export function CashflowPeriodProvider({ children }: { children: ReactNode }) {
  const [period, setPeriod] = useState<Period>("this-month");
  return <PeriodContext value={{ period, setPeriod }}>{children}</PeriodContext>;
}

export function useCashflowPeriod(): PeriodState {
  const ctx = useContext(PeriodContext);
  if (!ctx) throw new Error("useCashflowPeriod must be used within a CashflowPeriodProvider");
  return ctx;
}
