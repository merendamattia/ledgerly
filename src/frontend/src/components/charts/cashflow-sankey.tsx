"use client";

import { useMemo } from "react";
import {
  EChartsSankeyChart,
  type ChartConfig,
  type SankeyData,
} from "@/components/evilcharts/charts/echarts-sankey-chart";
import { usePrivateNumberFormatter } from "@/components/private-number";
import { useIsMobile } from "@/hooks/use-mobile";
import { formatMoney } from "@/lib/format";

export interface SankeyFlow {
  label: string;
  value: number;
}

const TOP_N = 5;

/** Collapses a flow list to the top entries plus an aggregated "Other" row. */
function collapse(items: SankeyFlow[], limit = TOP_N): SankeyFlow[] {
  const sorted = [...items].sort((a, b) => b.value - a.value);
  if (sorted.length <= limit + 1) return sorted;
  const rest = sorted.slice(limit).reduce((total, item) => total + item.value, 0);
  return [...sorted.slice(0, limit), { label: "Other", value: rest }];
}

/** Renders income, savings, investments and spending as an EvilCharts Sankey. */
export function CashFlowSankey({
  income,
  expense,
  investments = [],
  sources,
  expenses,
  currency,
  className,
  isLoading = false,
}: {
  income: number;
  expense: number;
  investments?: SankeyFlow[];
  sources: SankeyFlow[];
  expenses: SankeyFlow[];
  currency: string;
  className?: string;
  isLoading?: boolean;
}) {
  const { privateText } = usePrivateNumberFormatter();
  const isMobile = useIsMobile();
  const money = (value: number) => privateText(formatMoney(value, currency));

  const { data, config } = useMemo(() => {
    const nodes: SankeyData["nodes"] = [];
    const links: SankeyData["links"] = [];
    const chartConfig: ChartConfig = {};
    const addNode = (name: string, label: string, color: string) => {
      const index = nodes.push({ name }) - 1;
      chartConfig[name] = { label, colors: { light: [color] } };
      return index;
    };

    const inflow = collapse(sources, isMobile ? 4 : TOP_N);
    const investmentOutflow = collapse(investments, isMobile ? 4 : TOP_N);
    const outflow = collapse(expenses, isMobile ? 4 : TOP_N);
    const invested = investments.reduce((total, item) => total + item.value, 0);
    const net = Math.max(0, income - expense - invested);
    const hub = addNode("cash", "Cash available", "var(--positive)");

    inflow.forEach((item, index) => {
      const source = addNode(`income-${index}`, item.label, `var(--chart-${(index % 2) + 1})`);
      links.push({ source, target: hub, value: item.value });
    });

    if (net > 0) {
      const savings = addNode("savings", "Net savings", "var(--primary)");
      links.push({ source: hub, target: savings, value: net });
    }

    investmentOutflow.forEach((item, index) => {
      const target = addNode(`investment-${index}`, item.label, "var(--accent-gold)");
      links.push({ source: hub, target, value: item.value });
    });

    outflow.forEach((item, index) => {
      const target = addNode(`expense-${index}`, item.label, `var(--chart-${(index % 4) + 3})`);
      links.push({ source: hub, target, value: item.value });
    });

    return { data: { nodes, links }, config: chartConfig };
  }, [expense, expenses, income, investments, isMobile, sources]);

  if (income <= 0 && !isLoading) {
    return <p className="py-12 text-center text-sm text-muted-foreground">No cash flow in range.</p>;
  }

  return (
    <div className={className}>
      <p className="mb-2 text-right text-[11px] text-muted-foreground sm:hidden">
        Swipe to explore →
      </p>
      <div className="-mx-1 overflow-x-auto rounded-xl border border-border/60 bg-muted/25">
        <div className="h-[380px] min-w-[560px] p-2 sm:h-[460px] sm:min-w-0 sm:p-3">
          <EChartsSankeyChart
            data={data}
            config={config}
            className="h-full w-full"
            nodeWidth={isMobile ? 10 : 14}
            nodePadding={isMobile ? 12 : 18}
            linkCurvature={0.55}
            isLoading={isLoading}
          >
            <EChartsSankeyChart.Tooltip roundness="xl" valueFormatter={money} />
            <EChartsSankeyChart.Link variant="gradient" />
            <EChartsSankeyChart.Node radius={5} isClickable>
              <EChartsSankeyChart.NodeLabel
                position="outside"
                showValues={!isMobile}
                valueFormatter={money}
              />
            </EChartsSankeyChart.Node>
          </EChartsSankeyChart>
        </div>
      </div>
    </div>
  );
}
