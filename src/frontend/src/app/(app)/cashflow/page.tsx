"use client";

import { useMemo } from "react";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { CashFlowChart } from "@/components/charts/cashflow-chart";
import { CashFlowSankey } from "@/components/charts/cashflow-sankey";
import { BalanceCard } from "@/components/cashflow/balance-card";
import { ComparisonCard } from "@/components/cashflow/comparison-card";
import { AccumulatedCard } from "@/components/cashflow/accumulated-card";
import { CategoryBreakdown } from "@/components/cashflow/category-breakdown";
import { useCashflowPeriod } from "@/components/cashflow/period-context";
import { resolvePeriod, trailingRange, ytdRange } from "@/components/cashflow/periods";
import { useExpenses, type Transaction } from "@/hooks/use-expenses";
import { useSettings } from "@/hooks/use-settings";

/** Sums all transactions matching one cashflow direction. */
const sumOf = (tx: Transaction[], dir: "INCOME" | "EXPENSE") =>
  tx.filter((t) => t.direction === dir).reduce((s, t) => s + t.amount, 0);

const INVESTMENT_CATEGORY_RE =
  /invest|etf|stock|equit|azion|crypto|btc|fund|fond[oi]?|bond|obblig|pac|accumul/i;

/** Investment buys booked as expenses are savings/capital moves, not spending. */
const isInvestmentTx = (t: Transaction) =>
  t.direction === "EXPENSE" && INVESTMENT_CATEGORY_RE.test(t.category?.name ?? "");

const spendingTx = (tx: Transaction[]) => tx.filter((t) => !isInvestmentTx(t));

/** Groups transactions of one direction by category, sorted from high to low. */
function byCategory(tx: Transaction[], dir: "INCOME" | "EXPENSE") {
  const map = new Map<string, number>();
  for (const t of tx) {
    if (t.direction !== dir) continue;
    const name = t.category?.name ?? (dir === "INCOME" ? "Other income" : "Uncategorized");
    map.set(name, (map.get(name) ?? 0) + t.amount);
  }
  return [...map.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
}

/** Builds per-month income, expense and investment buckets in ascending month order. */
function monthBuckets(tx: Transaction[]) {
  const buckets = new Map<string, { month: string; income: number; expense: number; investment: number }>();
  for (const t of tx) {
    const month = t.date.slice(0, 7);
    const b = buckets.get(month) ?? { month, income: 0, expense: 0, investment: 0 };
    if (t.direction === "INCOME") b.income += t.amount;
    else if (isInvestmentTx(t)) b.investment += t.amount;
    else b.expense += t.amount;
    buckets.set(month, b);
  }
  return [...buckets.values()].sort((a, b) => a.month.localeCompare(b.month));
}

/** Renders the cashflow analytics page for the selected period. */
export default function CashFlowPage() {
  const { period } = useCashflowPeriod();
  const settings = useSettings();
  const currency = settings.data?.baseCurrency ?? "EUR";

  const rp = useMemo(() => resolvePeriod(period), [period]);
  const trailing = useMemo(() => trailingRange(rp.to, 6), [rp.to]);
  const ytd = useMemo(() => ytdRange(), []);

  const current = useExpenses({ from: rp.from, to: rp.to, limit: 5000 });
  const previous = useExpenses({ from: rp.prevFrom, to: rp.prevTo, limit: 5000 });
  const trend = useExpenses({ from: trailing.from, to: trailing.to, limit: 5000 });
  const accumulated = useExpenses({ from: ytd.from, to: ytd.to, limit: 5000 });

  const tx = useMemo(() => current.data ?? [], [current.data]);
  const prevTx = useMemo(() => previous.data ?? [], [previous.data]);
  const spendTx = useMemo(() => spendingTx(tx), [tx]);
  const prevSpendTx = useMemo(() => spendingTx(prevTx), [prevTx]);
  const investment = useMemo(
    () => tx.filter(isInvestmentTx).reduce((sum, t) => sum + t.amount, 0),
    [tx],
  );
  const prevInvestment = useMemo(
    () => prevTx.filter(isInvestmentTx).reduce((sum, t) => sum + t.amount, 0),
    [prevTx],
  );

  const income = sumOf(tx, "INCOME");
  const expense = sumOf(spendTx, "EXPENSE");
  const liquidNet = income - expense - investment;
  const netSavings = liquidNet + investment;
  const savingsRate = income > 0 ? Math.round((netSavings / income) * 100) : 0;

  const prevIncome = sumOf(prevTx, "INCOME");
  const prevExpense = sumOf(prevSpendTx, "EXPENSE");
  const prevLiquidNet = prevIncome - prevExpense - prevInvestment;

  const expenseCats = useMemo(() => byCategory(spendTx, "EXPENSE"), [spendTx]);
  const incomeCats = useMemo(() => byCategory(tx, "INCOME"), [tx]);

  const trendSeries = useMemo(() => monthBuckets(trend.data ?? []), [trend.data]);

  // Accumulated savings (YTD): running net total, this-month contribution, and a
  // monthly cumulative series for the sparkline.
  const ytdData = useMemo(() => {
    const months = monthBuckets(accumulated.data ?? []);
    const series = months.reduce<number[]>((acc, m) => {
      const prev = acc.length ? acc[acc.length - 1] : 0;
      acc.push(prev + m.income - m.expense);
      return acc;
    }, []);
    const total = series.length ? series[series.length - 1] : 0;
    const thisMonth = rp.from.slice(0, 7);
    const monthDelta = (months.find((m) => m.month === thisMonth) ?? { income: 0, expense: 0 }) as {
      income: number;
      expense: number;
      investment?: number;
    };
    return { total, series, monthDelta: monthDelta.income - monthDelta.expense };
  }, [accumulated.data, rp.from]);

  return (
    <div className="flex flex-col gap-4 animate-fu md:gap-5">
      <div className="grid grid-cols-1 gap-4 md:gap-5 lg:grid-cols-12">
        <div className="lg:col-span-5">
          <BalanceCard
            subtitle={`Net savings · ${rp.label}`}
            net={netSavings}
            income={income}
            expense={expense}
            investment={investment}
            savingsRate={savingsRate}
            currency={currency}
          />
        </div>
        <div className="lg:col-span-4">
          <ComparisonCard
            prevLabel={`vs ${rp.prevLabel}`}
            currency={currency}
            rows={[
              { label: "Income", prev: prevIncome, curr: income, goodWhenUp: true },
              { label: "Expenses", prev: prevExpense, curr: expense, goodWhenUp: false },
              {
                label: "Net savings",
                prev: prevLiquidNet + prevInvestment,
                curr: netSavings,
                goodWhenUp: true,
              },
            ]}
          />
        </div>
        <div className="lg:col-span-3">
          <AccumulatedCard
            total={ytdData.total}
            monthDelta={ytdData.monthDelta}
            series={ytdData.series}
            currency={currency}
          />
        </div>

        {/* Flex chart: the row height is driven by the breakdown card on the
            right; the chart is absolutely positioned so it fills that height
            instead of leaving whitespace below. */}
        <Card className="flex flex-col gap-0 p-6 lg:col-span-7">
          <CardHeader className="px-0">
            <CardTitle className="font-display font-semibold">Monthly trend</CardTitle>
          </CardHeader>
          {trendSeries.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No data in range.</p>
          ) : (
            <div className="relative mt-4 min-h-[280px] flex-1">
              <div className="absolute inset-0">
                <CashFlowChart
                  data={trendSeries}
                  currency={currency}
                  className="aspect-auto h-full w-full"
                />
              </div>
            </div>
          )}
        </Card>

        <div className="lg:col-span-5">
          <CategoryBreakdown
            expenses={expenseCats}
            income={incomeCats}
            expenseTotal={expense}
            incomeTotal={income}
            currency={currency}
            periodLabel={rp.label}
          />
        </div>

        <Card className="gap-0 overflow-hidden p-6 lg:col-span-12">
          <CardHeader className="flex flex-col gap-2 px-0 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="flex items-center gap-2.5">
                <CardTitle className="font-display font-semibold">Cash flow</CardTitle>
                <span className="rounded-md bg-accent px-2 py-0.5 text-xs font-semibold text-accent-foreground">
                  {rp.label}
                </span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                How income splits into net savings, investing and spending
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-[3px] bg-positive" />
                Inflow
              </span>
              <span className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-[3px] bg-primary" />
                Net savings
              </span>
              <span className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-[3px] bg-accent-gold" />
                Investments
              </span>
              <span className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-[3px] bg-negative" />
                Spending
              </span>
            </div>
          </CardHeader>
          <div className="mt-4">
            <CashFlowSankey
              income={income}
              expense={expense}
              investments={investment > 0 ? [{ label: "Investments", value: investment }] : []}
              sources={incomeCats.map((c) => ({ label: c.name, value: c.value }))}
              expenses={expenseCats.map((c) => ({ label: c.name, value: c.value }))}
              currency={currency}
            />
          </div>
        </Card>
      </div>
    </div>
  );
}
