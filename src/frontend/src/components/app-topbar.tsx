"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Plus, Search } from "lucide-react";
import { useSearch } from "@/components/search-context";
import { useCashflowPeriod } from "@/components/cashflow/period-context";
import { PeriodPicker } from "@/components/cashflow/period-picker";
import { periodOptions, resolvePeriod } from "@/components/cashflow/periods";
import type { AddMode } from "@/components/add-transaction-dialog";
import { Button } from "@/components/ui/button";

const AddTransactionDialog = dynamic(
  () => import("@/components/add-transaction-dialog").then((mod) => mod.AddTransactionDialog),
  { ssr: false },
);

/** Renders the Ledgerly app icon used in the sticky topbar. */
function Logo() {
  return (
    <span className="flex size-10 shrink-0 items-center justify-center">
      <Image
        src="/icons/icon-192.png"
        alt=""
        width={192}
        height={192}
        priority
        unoptimized
        className="size-10 rounded-lg object-cover"
      />
    </span>
  );
}

type PageMeta = { title: string; subtitle: string };

const PAGE_META: Record<string, PageMeta> = {
  "/": { title: "Overview", subtitle: "An at-a-glance view of your wealth" },
  "/investments": {
    title: "Assets & Investments",
    subtitle: "Portfolio, performance and allocation",
  },
  "/cashflow": { title: "Expenses & Cash Flow", subtitle: "Income, spending and monthly flows" },
  "/transactions": { title: "Transactions", subtitle: "All your recent movements" },
  "/matrix": { title: "Matrices", subtitle: "Assets and cash flow across monthly snapshots" },
};

/**
 * Returns topbar copy for app sections that do not render their own page header.
 *
 * Admin pages such as settings, database, and accounts render their own
 * `PageHeader`, so this intentionally returns `null` for those routes.
 */
function metaFor(pathname: string): PageMeta | null {
  if (pathname === "/") return PAGE_META["/"];
  const match = Object.keys(PAGE_META).find((p) => p !== "/" && pathname.startsWith(p));
  return match ? PAGE_META[match] : null;
}

/**
 * Resolves the contextual creation mode for the current route.
 *
 * The "+ Add" button only appears on sections that can create a movement, and
 * the mode scopes the dialog to the actions that make sense for that section.
 */
function addModeFor(pathname: string): AddMode | null {
  if (pathname.startsWith("/transactions")) return "full";
  if (pathname.startsWith("/cashflow")) return "cashflow";
  if (pathname.startsWith("/investments")) return "investment";
  return null;
}

const ADD_LABEL: Record<AddMode, string> = {
  full: "Add transaction",
  cashflow: "Add expense",
  investment: "Add investment",
};

/**
 * Renders the cashflow period selector backed by `CashflowPeriodProvider`.
 */
function CashflowPeriodControl() {
  const { period, setPeriod } = useCashflowPeriod();
  return (
    <PeriodPicker
      value={period}
      label={resolvePeriod(period).label}
      options={periodOptions()}
      onChange={setPeriod}
      triggerClassName="w-auto min-w-0 max-w-[170px] px-3.5 py-2 sm:min-w-0"
    />
  );
}

/** Renders the sticky app topbar with section metadata and contextual actions. */
export function AppTopbar() {
  const pathname = usePathname();
  const { query, setQuery } = useSearch();
  const [addOpenFor, setAddOpenFor] = useState<string | null>(null);
  const meta = metaFor(pathname);
  const showSearch = pathname.startsWith("/transactions");
  const showPeriod = pathname.startsWith("/cashflow");
  const addMode = addModeFor(pathname);
  const addOpen = addOpenFor === pathname;

  const searchField = (
    <div className="relative">
      <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search transactions…"
        className="h-9 w-full rounded-lg border bg-card pr-3 pl-9 text-base outline-none placeholder:text-muted-foreground focus:border-ring md:text-sm"
      />
    </div>
  );

  return (
    <header className="sticky top-0 z-10 border-b bg-background/80 px-4 py-3 backdrop-blur-md md:px-8 md:py-4">
      <div className="flex items-center justify-between gap-3">
        <Link href="/" className="flex min-w-0 items-center gap-2.5">
          <Logo />
          <div className="min-w-0">
            <span className="block font-display text-lg font-bold tracking-tight md:text-xl">
              Ledgerly
            </span>
            {meta ? (
              <span className="block truncate text-xs text-muted-foreground">{meta.title}</span>
            ) : null}
          </div>
        </Link>

        <div className="flex items-center gap-2">
          {showSearch ? <div className="hidden w-56 sm:block">{searchField}</div> : null}

          {showPeriod ? <CashflowPeriodControl /> : null}

          {addMode ? (
            <>
              <Button className="gap-1.5" onClick={() => setAddOpenFor(pathname)}>
                <Plus data-icon="inline-start" />
                <span className="hidden sm:inline">{ADD_LABEL[addMode]}</span>
                <span className="sr-only sm:hidden">{ADD_LABEL[addMode]}</span>
              </Button>
              {addOpen ? (
                <AddTransactionDialog
                  mode={addMode}
                  open
                  onOpenChange={(open) => setAddOpenFor(open ? pathname : null)}
                />
              ) : null}
            </>
          ) : null}
        </div>
      </div>

      {/* On phones the search drops to a full-width row instead of vanishing. */}
      {showSearch ? <div className="mt-3 sm:hidden">{searchField}</div> : null}
    </header>
  );
}
