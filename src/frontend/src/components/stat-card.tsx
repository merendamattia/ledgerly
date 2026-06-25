import type { ComponentType, ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type Accent = "primary" | "positive" | "negative";

const accentTile: Record<Accent, string> = {
  primary: "bg-primary/10 text-primary",
  positive: "bg-positive/10 text-positive",
  negative: "bg-negative/10 text-negative",
};

const deltaTone = {
  positive: "bg-positive/10 text-positive",
  negative: "bg-negative/10 text-negative",
  muted: "bg-muted text-muted-foreground",
} as const;

/**
 * Renders a KPI card with an optional accent icon, delta chip, and footer slot.
 */
export function StatCard({
  label,
  value,
  icon: Icon,
  accent = "primary",
  delta,
  children,
}: {
  label: string;
  value: ReactNode;
  icon?: ComponentType<{ className?: string }>;
  accent?: Accent;
  delta?: { label: string; tone?: keyof typeof deltaTone };
  children?: ReactNode;
}) {
  return (
    <Card className="gap-0 p-5">
      <div className="flex items-start justify-between gap-3">
        <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          {label}
        </span>
        {Icon ? (
          <div className={cn("flex size-9 items-center justify-center rounded-lg", accentTile[accent])}>
            <Icon className="size-4.5" />
          </div>
        ) : null}
      </div>

      <div className="mt-3 flex items-baseline gap-2">
        <span className="text-2xl font-semibold tracking-tight tabular-nums sm:text-3xl">{value}</span>
        {delta ? (
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-xs font-medium",
              deltaTone[delta.tone ?? "muted"],
            )}
          >
            {delta.label}
          </span>
        ) : null}
      </div>

      {children ? <div className="mt-4">{children}</div> : null}
    </Card>
  );
}
