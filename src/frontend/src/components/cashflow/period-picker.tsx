"use client";

import { MonthYearPicker } from "@/components/month-year-picker";
import type { Period } from "./periods";

/**
 * Renders the calendar-style period selector used by the cashflow topbar.
 */
export function PeriodPicker({
  value,
  label,
  options,
  onChange,
  triggerClassName,
}: {
  value: Period;
  label: string;
  options: { value: Period; label: string }[];
  onChange: (value: Period) => void;
  triggerClassName?: string;
}) {
  return (
    <MonthYearPicker
      value={value}
      label={label}
      options={options}
      onChange={(next) => onChange(next as Period)}
      triggerClassName={triggerClassName}
    />
  );
}
