"use client";

import { Cell, Pie, PieChart } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { formatMoney } from "@/lib/format";

const chartConfig = {
  income: { label: "Income", color: "var(--chart-2)" },
  expense: { label: "Expense", color: "var(--chart-3)" },
} satisfies ChartConfig;

// Income vs expense totals for the selected range, with the net in the centre.
export function IncomeExpensePie({
  income,
  expense,
  currency,
}: {
  income: number;
  expense: number;
  currency: string;
}) {
  const data = [
    { key: "income", name: "Income", value: income, fill: "var(--chart-2)" },
    { key: "expense", name: "Expense", value: expense, fill: "var(--chart-3)" },
  ].filter((d) => d.value > 0);

  const net = income - expense;

  if (data.length === 0) {
    return (
      <div className="flex h-[240px] items-center justify-center text-sm text-muted-foreground">
        No transactions in range.
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-5">
      <div className="relative">
        <ChartContainer config={chartConfig} className="aspect-square h-[200px]">
          <PieChart>
            <ChartTooltip
              content={<ChartTooltipContent formatter={(v) => formatMoney(Number(v), currency)} />}
            />
            <Pie data={data} dataKey="value" nameKey="name" innerRadius={64} strokeWidth={2}>
              {data.map((entry) => (
                <Cell key={entry.key} fill={entry.fill} />
              ))}
            </Pie>
          </PieChart>
        </ChartContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xs text-muted-foreground">Net</span>
          <span className="text-lg font-semibold tabular-nums">{formatMoney(net, currency)}</span>
        </div>
      </div>

      <ul className="grid w-full gap-2">
        {data.map((d) => (
          <li key={d.key} className="flex items-center gap-2 text-sm">
            <span className="size-2.5 rounded-full" style={{ backgroundColor: d.fill }} />
            <span className="text-muted-foreground">{d.name}</span>
            <span className="ml-auto font-medium tabular-nums">{formatMoney(d.value, currency)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
