"use client";

import {
  EChartsPieChart,
  type ChartConfig,
} from "@/components/evilcharts/charts/echarts-pie-chart";
import { formatMoney } from "@/lib/format";
import { MoneyAmount } from "@/components/money-amount";
import { usePrivateNumberFormatter } from "@/components/private-number";
import { useIsMobile } from "@/hooks/use-mobile";

const chartConfig = {
  income: { label: "Income", colors: { light: ["var(--positive)"] } },
  expense: { label: "Expense", colors: { light: ["var(--negative)"] } },
} satisfies ChartConfig;

/** Renders income and expense totals with net cashflow in the center. */
export function IncomeExpensePie({
  income,
  expense,
  currency,
}: {
  income: number;
  expense: number;
  currency: string;
}) {
  const { privateText } = usePrivateNumberFormatter();
  const isMobile = useIsMobile();
  const data = [
    { key: "income", name: "Income", value: income, fill: "var(--positive)" },
    { key: "expense", name: "Expense", value: expense, fill: "var(--negative)" },
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
        <EChartsPieChart
          config={chartConfig}
          data={data}
          dataKey="value"
          nameKey="key"
          className="aspect-square h-[176px] bg-transparent p-0 sm:h-[200px] sm:p-0"
        >
          <EChartsPieChart.Tooltip
            roundness="xl"
            valueFormatter={(value) => privateText(formatMoney(value, currency))}
          />
          <EChartsPieChart.Pie
            innerRadius={isMobile ? 48 : 56}
            outerRadius={isMobile ? 76 : 86}
            paddingAngle={1.5}
            cornerRadius={6}
          />
        </EChartsPieChart>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xs text-muted-foreground">Net</span>
          <MoneyAmount
            value={net}
            currency={currency}
            className="block max-w-[8.5rem] truncate text-center text-base font-semibold sm:text-lg"
          />
        </div>
      </div>

      <ul className="grid w-full gap-2">
        {data.map((d) => (
          <li key={d.key} className="flex items-center gap-2 text-sm">
            <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: d.fill }} />
            <span className="min-w-0 flex-1 truncate text-muted-foreground">{d.name}</span>
            <MoneyAmount value={d.value} currency={currency} className="shrink-0 font-medium" />
          </li>
        ))}
      </ul>
    </div>
  );
}
