"use client";

import { useMemo, useState } from "react";
import { Wallet, ArrowDownUp, PiggyBank } from "lucide-react";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StatCard } from "@/components/stat-card";
import { MoneyAmount } from "@/components/money-amount";
import { CategoryIcon } from "@/components/category-badge";
import { CronSection } from "@/components/cron-section";
import { NetWorthChart } from "@/components/charts/net-worth-chart";
import { AllocationChart } from "@/components/charts/allocation-chart";
import { Sparkline } from "@/components/charts/sparkline";
import { useDashboard, type DashboardData } from "@/hooks/use-dashboard";
import { useSession } from "@/lib/auth-client";
import { formatMoney, formatPercent } from "@/lib/format";

type RecentTx = DashboardData["recentTransactions"][number];

const PERIODS = [
  { value: "30", label: "Last month" },
  { value: "90", label: "Last 3 months" },
  { value: "180", label: "Last 6 months" },
] as const;

const SAVINGS_GOAL = 30;

function displayName(email: string): string {
  const local = email.split("@")[0] ?? "";
  const first = local.split(/[._-]+/)[0] ?? local;
  return first ? first.charAt(0).toUpperCase() + first.slice(1) : "there";
}

function relativeDate(iso: string): string {
  const start = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((start(new Date()) - start(new Date(iso))) / 86_400_000);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}

export default function DashboardPage() {
  const { data, isLoading } = useDashboard();
  const { data: session } = useSession();
  const [period, setPeriod] = useState<string>("180");

  const nw = data?.netWorth;
  const currency = nw?.baseCurrency ?? "EUR";
  const cashFlow = data?.cashFlowMonth ?? { income: 0, expense: 0 };
  const net = cashFlow.income - cashFlow.expense;
  const savingsRate = cashFlow.income > 0 ? (net / cashFlow.income) * 100 : 0;

  const sliced = useMemo(() => {
    const snaps = data?.snapshots ?? [];
    return snaps.slice(Math.max(0, snaps.length - Number(period)));
  }, [data?.snapshots, period]);

  const nwDelta = useMemo(() => {
    if (sliced.length < 2) return null;
    const first = sliced[0].totalValue;
    const last = sliced[sliced.length - 1].totalValue;
    if (!first) return null;
    const pct = ((last - first) / first) * 100;
    return { label: `${formatPercent(pct)}`, tone: pct >= 0 ? "positive" : "negative" } as const;
  }, [sliced]);

  const cashFlowMax = Math.max(cashFlow.income, cashFlow.expense, 1);
  const name = displayName(session?.user.email ?? "");

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Welcome back, {name}</h1>
        <p className="text-sm text-muted-foreground">Here is your financial snapshot for today.</p>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <StatCard
          label="Net worth"
          value={isLoading ? "…" : formatMoney(nw?.total ?? 0, currency)}
          icon={Wallet}
          accent="primary"
          delta={nwDelta ?? undefined}
        >
          <Sparkline
            values={sliced.map((s) => s.totalValue)}
            className="h-9 w-full"
            stroke="var(--primary)"
          />
        </StatCard>

        <StatCard
          label="Monthly cash flow"
          value={isLoading ? "…" : formatMoney(net, currency)}
          icon={ArrowDownUp}
          accent={net >= 0 ? "positive" : "negative"}
        >
          <div className="flex flex-col gap-2.5">
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Income</span>
                <MoneyAmount value={cashFlow.income} currency={currency} className="font-medium" />
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-positive"
                  style={{ width: `${(cashFlow.income / cashFlowMax) * 100}%` }}
                />
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Expenses</span>
                <MoneyAmount value={cashFlow.expense} currency={currency} className="font-medium" />
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-negative"
                  style={{ width: `${(cashFlow.expense / cashFlowMax) * 100}%` }}
                />
              </div>
            </div>
          </div>
        </StatCard>

        <StatCard
          label="Savings rate"
          value={isLoading ? "…" : `${Math.round(savingsRate)}%`}
          icon={PiggyBank}
          accent="primary"
        >
          <div className="flex flex-col gap-2">
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary"
                style={{ width: `${Math.min(100, (savingsRate / SAVINGS_GOAL) * 100)}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Goal {SAVINGS_GOAL}%.{" "}
              {savingsRate >= SAVINGS_GOAL ? "Goal reached, great work." : "Keep it up this month."}
            </p>
          </div>
        </StatCard>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Net worth trend</CardTitle>
            <CardAction>
              <Select value={period} onValueChange={(v) => setPeriod(v ?? "180")}>
                <SelectTrigger className="h-8 w-[160px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PERIODS.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardAction>
          </CardHeader>
          <CardContent>
            <NetWorthChart data={sliced} currency={currency} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Asset allocation</CardTitle>
          </CardHeader>
          <CardContent>
            <AllocationChart allocation={nw?.allocation ?? {}} currency={currency} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="px-6">
          <CardTitle>Recent transactions</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <ul className="divide-y">
            {isLoading ? (
              <li className="px-6 py-4 text-sm text-muted-foreground">Loading…</li>
            ) : (data?.recentTransactions ?? []).length === 0 ? (
              <li className="px-6 py-8 text-center text-sm text-muted-foreground">
                No transactions yet.
              </li>
            ) : (
              data?.recentTransactions.map((t: RecentTx) => {
                const signed = t.direction === "EXPENSE" ? -t.amount : t.amount;
                return (
                  <li key={t.id} className="flex items-center gap-3 px-6 py-3.5">
                    <CategoryIcon name={t.category?.name} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {t.note || t.category?.name || "Transaction"}
                      </p>
                      <p className="text-xs text-muted-foreground">{t.category?.name ?? "—"}</p>
                    </div>
                    <span className="hidden text-xs text-muted-foreground sm:block">
                      {relativeDate(t.date)}
                    </span>
                    <MoneyAmount
                      value={signed}
                      currency={currency}
                      colored
                      signed
                      className="w-28 text-right text-sm font-medium"
                    />
                  </li>
                );
              })
            )}
          </ul>
        </CardContent>
      </Card>

      <CronSection />
    </div>
  );
}
