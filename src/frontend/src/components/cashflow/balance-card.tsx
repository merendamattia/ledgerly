import { Card } from "@/components/ui/card";
import { MoneyAmount } from "@/components/money-amount";

// Ink "spotlight" card matching the design: net result up top in lime, the
// income/expense split (signed, colored) below, and a savings-rate chip at the
// foot showing the amount saved. The two split colors have no light-theme tokens
// (they're tuned for contrast on the dark surface), so they're inline hex like
// the source design — same exception as category-badge.
const GREEN = "#9fd356";
const RED = "#e8765b";

export function BalanceCard({
  subtitle,
  net,
  income,
  expense,
  savingsRate,
  currency,
}: {
  subtitle: string;
  net: number;
  income: number;
  expense: number;
  savingsRate: number;
  currency: string;
}) {
  return (
    <Card className="h-full gap-0 border-0 bg-sidebar p-6 text-sidebar-accent-foreground shadow-card ring-0">
      <span className="text-xs font-medium tracking-wide text-sidebar-foreground">{subtitle}</span>
      <div className="mt-1.5 flex items-baseline gap-3">
        <span className="font-mono text-4xl font-semibold tracking-tight tabular-nums text-primary">
          <MoneyAmount value={net} currency={currency} />
        </span>
        <span className="font-mono text-xl font-semibold tabular-nums text-primary/70">
          {savingsRate}%
        </span>
      </div>

      <div className="mt-6 flex gap-6 border-t border-sidebar-border pt-5">
        <div className="flex-1">
          <div className="flex items-center gap-1.5 text-xs text-sidebar-foreground">
            <span className="size-2 rounded-[3px]" style={{ background: GREEN }} />
            Income
          </div>
          <div className="mt-1.5 font-mono text-xl font-semibold tabular-nums" style={{ color: GREEN }}>
            <MoneyAmount value={income} currency={currency} signed />
          </div>
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-1.5 text-xs text-sidebar-foreground">
            <span className="size-2 rounded-[3px]" style={{ background: RED }} />
            Expenses
          </div>
          <div className="mt-1.5 font-mono text-xl font-semibold tabular-nums" style={{ color: RED }}>
            −<MoneyAmount value={expense} currency={currency} />
          </div>
        </div>
      </div>
    </Card>
  );
}
