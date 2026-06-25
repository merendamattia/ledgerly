import { cn } from "@/lib/utils";
import { formatMoney } from "@/lib/format";
import { PrivateNumber } from "@/components/private-number";

/**
 * Renders a monetary value with tabular figures and optional sign-based styling.
 */
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
  return <PrivateNumber text={text} className={cn(tone, className)} />;
}
