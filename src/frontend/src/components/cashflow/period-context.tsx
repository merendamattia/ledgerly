"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import type { Period } from "./periods";

type PeriodState = { period: Period; setPeriod: (p: Period) => void };

const PeriodContext = createContext<PeriodState | null>(null);

/**
 * Provides transient cashflow period state to the topbar and cashflow page.
 */
export function CashflowPeriodProvider({ children }: { children: ReactNode }) {
  const [period, setPeriod] = useState<Period>("this-month");
  return <PeriodContext value={{ period, setPeriod }}>{children}</PeriodContext>;
}

/** Reads the selected cashflow period from context. */
export function useCashflowPeriod(): PeriodState {
  const ctx = useContext(PeriodContext);
  if (!ctx) throw new Error("useCashflowPeriod must be used within a CashflowPeriodProvider");
  return ctx;
}
