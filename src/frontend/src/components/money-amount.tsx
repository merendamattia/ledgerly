import { cn } from "@/lib/utils";
import { formatMoney } from "@/lib/format";

// Renders a monetary value with tabular figures for clean column alignment.
// `colored` tints by sign (income green / expense red); `signed` adds a leading
// "+" for positive values. Pass a pre-signed value to show direction.
export function MoneyAmount({
  value,
  currency = "EUR",
  className,
  colored = false,
  signed = false,
}: {
  value: number;
  currency?: string;
  className?: string;
  colored?: boolean;
  signed?: boolean;
}) {
  const tone = colored
    ? value < 0
      ? "text-negative"
      : value > 0
        ? "text-positive"
        : ""
    : "";
  const formatted = formatMoney(value, currency);
  const text = signed && value > 0 ? `+${formatted}` : formatted;
  return <span className={cn("tabular-nums", tone, className)}>{text}</span>;
}
