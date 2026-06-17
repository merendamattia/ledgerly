"use client";

import { CartesianGrid, Line, LineChart, XAxis } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { shortDate } from "@/lib/format";

const chartConfig = {
  portfolio: { label: "You", color: "var(--chart-1)" },
  benchmark: { label: "MSCI World", color: "var(--chart-3)" },
} satisfies ChartConfig;

// Two rebased growth indices (start = 100): portfolio vs benchmark.
export function BenchmarkChart({
  data,
}: {
  data: { date: string; portfolio: number; benchmark: number }[];
}) {
  const points = data.map((d) => ({
    date: shortDate(d.date),
    portfolio: d.portfolio,
    benchmark: d.benchmark,
  }));

  return (
    <ChartContainer config={chartConfig} className="h-[168px] w-full">
      <LineChart data={points} margin={{ left: 4, right: 4, top: 4 }}>
        <CartesianGrid vertical={false} strokeDasharray="3 5" />
        <XAxis
          dataKey="date"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          minTickGap={36}
          tick={{ fontSize: 11 }}
        />
        <ChartTooltip
          content={
            <ChartTooltipContent formatter={(v) => `${Number(v).toFixed(1)}`} indicator="line" />
          }
        />
        <Line
          dataKey="portfolio"
          type="monotone"
          stroke="var(--color-portfolio)"
          strokeWidth={2.4}
          dot={false}
          activeDot={{ r: 4 }}
        />
        <Line
          dataKey="benchmark"
          type="monotone"
          stroke="var(--color-benchmark)"
          strokeWidth={2}
          strokeDasharray="5 4"
          dot={false}
          activeDot={{ r: 4 }}
        />
      </LineChart>
    </ChartContainer>
  );
}
