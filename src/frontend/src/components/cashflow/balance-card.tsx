import { Card } from "@/components/ui/card";
import { MoneyAmount } from "@/components/money-amount";

// Ink "spotlight" card matching the design: net result up top in lime, the
// income/expense split (signed, colored) below, and a savings-rate chip at the
// foot showing the amount saved. The two split colors have no light-theme tokens
// (they're tuned for contrast on the dark surface), so they're inline hex like
// the source design — same exception as category-badge.
const GREEN = "#9fd356";
const RED = "#e8765b";
const ORANGE = "var(--accent-gold)";

/** Renders the cashflow spotlight card with net, income, expense, and savings rate. */
export function BalanceCard({
  subtitle,
  net,
  income,
  expense,
  investment,
  savingsRate,
  currency,
}: {
  subtitle: string;
  net: number;
  income: number;
  expense: number;
  investment: number;
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

      <div className="mt-6 grid grid-cols-3 gap-4 border-t border-sidebar-border pt-5">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-xs text-sidebar-foreground">
            <span className="size-2 rounded-[3px]" style={{ background: GREEN }} />
            Income
          </div>
          <div className="mt-1.5 font-mono text-base font-semibold tabular-nums xl:text-xl" style={{ color: GREEN }}>
            <MoneyAmount value={income} currency={currency} signed />
          </div>
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-xs text-sidebar-foreground">
            <span className="size-2 rounded-[3px]" style={{ background: RED }} />
            Expenses
          </div>
          <div className="mt-1.5 font-mono text-base font-semibold tabular-nums xl:text-xl" style={{ color: RED }}>
            −<MoneyAmount value={expense} currency={currency} />
          </div>
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-xs text-sidebar-foreground">
            <span className="size-2 rounded-[3px]" style={{ background: ORANGE }} />
            Investments
          </div>
          <div className="mt-1.5 font-mono text-base font-semibold tabular-nums xl:text-xl" style={{ color: ORANGE }}>
            <MoneyAmount value={investment} currency={currency} signed />
          </div>
        </div>
      </div>
    </Card>
  );
}
