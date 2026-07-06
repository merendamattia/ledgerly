"use client";

import { useEffect, useRef } from "react";
import { Chart, LinearScale, Tooltip } from "chart.js";
import { SankeyController, Flow } from "chartjs-chart-sankey";
import { formatMoney } from "@/lib/format";
import { usePrivateNumberFormatter } from "@/components/private-number";

// Tree-shakeable Chart.js: register only what the sankey needs (controller +
// flow element + the linear scale it lays nodes on + tooltip).
Chart.register(SankeyController, Flow, LinearScale, Tooltip);

export interface SankeyFlow {
  label: string;
  value: number;
}

const TOP_N = 5;

/** Reads a CSS custom property from `:root` for canvas-only chart rendering. */
function token(name: string, fallback: string): string {
  if (typeof window === "undefined") return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

/** Lightens a `#rrggbb` color toward white by `amt` in the `0..1` range. */
function lighten(hex: string, amt: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  const mix = (c: number) => Math.round(c + (255 - c) * amt);
  return `#${[mix(r), mix(g), mix(b)].map((c) => c.toString(16).padStart(2, "0")).join("")}`;
}

/** Collapses a flow list to the top entries plus an aggregated "Other" row. */
function collapse(items: SankeyFlow[]): SankeyFlow[] {
  const sorted = [...items].sort((a, b) => b.value - a.value);
  if (sorted.length <= TOP_N + 1) return sorted;
  const rest = sorted.slice(TOP_N).reduce((t, c) => t + c.value, 0);
  return [...sorted.slice(0, TOP_N), { label: "Other", value: rest }];
}

/** Renders a Sankey diagram from income sources to savings and expense categories. */
export function CashFlowSankey({
  income,
  expense,
  investments = [],
  sources,
  expenses,
  currency,
  className,
}: {
  income: number;
  expense: number;
  investments?: SankeyFlow[];
  sources: SankeyFlow[];
  expenses: SankeyFlow[];
  currency: string;
  className?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { privateText } = usePrivateNumberFormatter();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || income <= 0) return;

    const ink = token("--foreground", "#1a1b14");
    const green = token("--positive", "#1c7a4d");
    const lime = token("--primary", "#c7f046");
    const orange = token("--accent-gold", "#eba23c");
    const expensePalette = [
      token("--negative", "#db5a3c"),
      token("--chart-3", "#3a72c4"),
      token("--chart-4", "#7b5bd6"),
      token("--chart-6", "#db5a3c"),
    ];
    const muted = token("--muted-foreground", "#807f70");

    const inflow = collapse(sources);
    const investmentOutflow = collapse(investments);
    const outflow = collapse(expenses);
    const invested = investments.reduce((total, item) => total + item.value, 0);
    const net = Math.max(0, income - expense - invested);

    const HUB = "hub";
    const NET = "sav:net";

    // Distinct color per node; canvas-safe hex values.
    const colorMap: Record<string, string> = { [HUB]: green, [NET]: lime };
    const labelMap: Record<string, string> = {
      [HUB]: `Cash available  ${privateText(formatMoney(income, currency))}`,
      [NET]: `Net savings  ${privateText(formatMoney(net, currency))}`,
    };
    const priority: Record<string, number> = { [HUB]: 0, [NET]: 0 };
    const column: Record<string, number> = { [HUB]: 1, [NET]: 2 };

    const data: { from: string; to: string; flow: number }[] = [];

    inflow.forEach((s, i) => {
      const key = `in:${s.label}`;
      colorMap[key] = s.label === "Other" ? muted : lighten(green, 0.12 + (i / Math.max(1, inflow.length)) * 0.45);
      labelMap[key] = `${s.label}  ${privateText(formatMoney(s.value, currency))}`;
      priority[key] = i;
      column[key] = 0;
      data.push({ from: key, to: HUB, flow: s.value });
    });

    if (net > 0) data.push({ from: HUB, to: NET, flow: net });

    investmentOutflow.forEach((c, i) => {
      const key = `inv:${c.label}`;
      colorMap[key] = c.label === "Other" ? muted : lighten(orange, (i / Math.max(1, investmentOutflow.length)) * 0.25);
      labelMap[key] = `${c.label}  ${privateText(formatMoney(c.value, currency))}`;
      priority[key] = i + 1;
      column[key] = 2;
      data.push({ from: HUB, to: key, flow: c.value });
    });

    outflow.forEach((c, i) => {
      const key = `out:${c.label}`;
      colorMap[key] = c.label === "Other" ? muted : expensePalette[i % expensePalette.length];
      labelMap[key] = `${c.label}  ${privateText(formatMoney(c.value, currency))}`;
      priority[key] = i + 1 + investmentOutflow.length; // net savings sits first
      column[key] = 2;
      data.push({ from: HUB, to: key, flow: c.value });
    });

    const colorOf = (ctx: { dataset: { data: { from: string; to: string }[] }; dataIndex: number }, end: "from" | "to") =>
      colorMap[ctx.dataset.data[ctx.dataIndex][end]] ?? muted;

    const chart = new Chart(canvas, {
      type: "sankey",
      data: {
        datasets: [
          {
            label: "Cash flow",
            data,
            colorFrom: (c) => colorOf(c, "from"),
            colorTo: (c) => colorOf(c, "to"),
            colorMode: "gradient",
            labels: labelMap,
            priority,
            column,
            size: "max",
            nodeWidth: 14,
            nodePadding: 28,
            borderWidth: 0,
            color: ink,
            font: { family: "Hanken Grotesk, sans-serif", size: 12, weight: 600 } as never,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        layout: { padding: { top: 8, bottom: 8, left: 6, right: 6 } },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (item) => {
                const d = item.dataset.data[item.dataIndex] as unknown as { flow: number };
                return privateText(formatMoney(d.flow, currency));
              },
            },
          },
        },
      },
    });

    return () => chart.destroy();
  }, [income, expense, investments, sources, expenses, currency, privateText]);

  if (income <= 0) {
    return <p className="py-12 text-center text-sm text-muted-foreground">No cash flow in range.</p>;
  }

  return (
    <div className={className}>
      {/* Scroll on narrow screens so nodes/labels keep room. */}
      <div className="-mx-1 overflow-x-auto px-1">
        <div className="h-[460px] min-w-[720px]">
          <canvas ref={canvasRef} role="img" aria-label="Cash flow Sankey diagram" />
        </div>
      </div>
    </div>
  );
}
