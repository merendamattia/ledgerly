"use client";

import Link from "next/link";
import { PieChart, TrendingUp, Coins, Building2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const card = "border shadow-card ring-0";

const PREVIEW = [
  { icon: TrendingUp, label: "Portfolio value", hint: "Holdings valued in your base currency" },
  { icon: PieChart, label: "Allocation by class", hint: "Equities, ETFs, crypto, bonds, cash" },
  { icon: Coins, label: "Performance & dividends", hint: "Returns per position and payouts" },
  { icon: Building2, label: "Liquidity snapshots", hint: "Track account balances over time" },
];

export default function InvestmentsPage() {
  return (
    <div className="flex flex-col gap-5 animate-fu">
      <Card className={`${card} flex flex-col items-center gap-3 p-12 text-center`}>
        <div className="flex size-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
          <PieChart className="size-7" />
        </div>
        <h2 className="font-display text-xl font-semibold">Assets & Investments</h2>
        <p className="max-w-md text-sm text-muted-foreground">
          Your portfolio cockpit is on the way — performance, allocation, dividends and liquidity
          snapshots. The data foundations (tickers, holdings, prices) are already in place.
        </p>
        <span className="mt-1 inline-flex items-center rounded-full bg-accent px-3 py-1 text-xs font-semibold text-accent-foreground">
          Coming soon
        </span>
        <div className="mt-2 flex gap-2">
          <Button nativeButton={false} render={<Link href="/" />}>
            Back to overview
          </Button>
          <Button variant="outline" nativeButton={false} render={<Link href="/transactions" />}>
            View transactions
          </Button>
        </div>
      </Card>

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {PREVIEW.map((p) => (
          <Card key={p.label} className={`${card} gap-0 p-5`}>
            <div className="flex size-9 items-center justify-center rounded-lg bg-accent text-accent-foreground">
              <p.icon className="size-4.5" />
            </div>
            <p className="mt-3 text-sm font-semibold">{p.label}</p>
            <p className="mt-1 text-xs text-muted-foreground">{p.hint}</p>
          </Card>
        ))}
      </div>
    </div>
  );
}
