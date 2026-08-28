import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { formatMoney, formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";
import { PrivateNumber } from "@/components/private-number";

/** Formats a signed monetary return while preserving the absolute currency format. */
function signedMoney(value: number, currency: string): string {
  if (value === 0) return formatMoney(0, currency);
  return `${value > 0 ? "+" : "-"}${formatMoney(Math.abs(value), currency)}`;
}

/** Renders a compact period performance badge with percent and absolute return. */
export function PeriodPerformance({
  pct,
  amount,
  currency = "EUR",
  period,
  label = "Return",
  className,
}: {
  pct: number;
  amount: number;
  currency?: string;
  period: string;
  label?: string;
  className?: string;
}) {
  const isNegative = pct < 0;
  const Icon = isNegative ? ArrowDownRight : ArrowUpRight;
  const periodLabel = period === "Max" ? "total" : period;

  return (
    <span className={cn("inline-flex flex-wrap items-center gap-x-2 gap-y-1", className)}>
      <span
        className={cn(
          "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold",
          isNegative ? "bg-negative/10 text-negative-ink" : "bg-positive/10 text-positive",
        )}
      >
        <Icon className="size-3.5" />
        {formatPercent(pct)} {periodLabel}
      </span>
      <span className="text-xs font-medium text-muted-foreground">
        {label}{" "}
        <span
          className={cn(
            "font-mono font-semibold tabular-nums",
            amount < 0 ? "text-negative-ink" : "text-positive",
          )}
        >
          <PrivateNumber text={signedMoney(amount, currency)} />
        </span>
      </span>
    </span>
  );
}
