"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { ChevronDown, LogOut, Plus, Search } from "lucide-react";
import { AppLogo } from "@/components/app-logo";
import {
  PRIMARY_NAV_ITEMS,
  SECONDARY_NAV_ITEMS,
  isNavItemActive,
} from "@/components/app-navigation";
import { useSearch } from "@/components/search-context";
import { useCashflowPeriod } from "@/components/cashflow/period-context";
import { PeriodPicker } from "@/components/cashflow/period-picker";
import { periodOptions, resolvePeriod } from "@/components/cashflow/periods";
import type { AddMode } from "@/components/add-transaction-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { signOut, useSession } from "@/lib/auth-client";
import { cn } from "@/lib/utils";

const AddTransactionDialog = dynamic(
  () => import("@/components/add-transaction-dialog").then((mod) => mod.AddTransactionDialog),
  { ssr: false },
);

type PageMeta = { title: string; subtitle: string };

const PAGE_META: Record<string, PageMeta> = {
  "/": { title: "Overview", subtitle: "Your financial position at a glance" },
  "/investments": { title: "Wealth", subtitle: "Portfolio, accounts and balance history" },
  "/cashflow": { title: "Cash flow", subtitle: "Income, spending and monthly flows" },
  "/transactions": { title: "Activity", subtitle: "All your recent movements" },
  "/accounts": { title: "Accounts", subtitle: "Tracked balances and registries" },
  "/matrix": { title: "Matrices", subtitle: "Monthly assets, returns and cash flow" },
  "/imports": { title: "Imports", subtitle: "Bring balances and movements into Ledgerly" },
  "/settings": { title: "Settings", subtitle: "Currency and transaction categories" },
  "/database": { title: "Database", subtitle: "Read-only data browser" },
  "/dev": { title: "Developer tools", subtitle: "Jobs and background activity" },
};

/** Returns the metadata for the current route. */
function metaFor(pathname: string): PageMeta {
  if (pathname === "/") return PAGE_META["/"];
  const route = Object.keys(PAGE_META).find(
    (candidate) => candidate !== "/" && pathname.startsWith(candidate),
  );
  return route ? PAGE_META[route] : { title: "Ledgerly", subtitle: "Personal finance console" };
}

/** Resolves the contextual creation mode for the current route. */
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

/** Renders the cash-flow period selector backed by the shared provider. */
function CashflowPeriodControl() {
  const { period, setPeriod } = useCashflowPeriod();
  return (
    <PeriodPicker
      value={period}
      label={resolvePeriod(period).label}
      options={periodOptions()}
      onChange={setPeriod}
      triggerClassName="w-auto min-w-0 max-w-36 px-3 sm:max-w-44"
    />
  );
}

/** Renders the sticky adaptive app header and desktop navigation. */
export function AppTopbar() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session } = useSession();
  const { query, setQuery } = useSearch();
  const [addOpenFor, setAddOpenFor] = useState<string | null>(null);
  const meta = metaFor(pathname);
  const showSearch = pathname.startsWith("/transactions");
  const showPeriod = pathname.startsWith("/cashflow");
  const showWealthNav = pathname.startsWith("/investments");
  const showAccounts = searchParams.get("view") === "accounts";
  const addMode = addModeFor(pathname);
  const moreActive = SECONDARY_NAV_ITEMS.some((item) =>
    isNavItemActive(pathname, item.href),
  );

  const searchField = (
    <label className="relative block min-w-0">
      <span className="sr-only">Search transactions</span>
      <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
      <input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search transactions…"
        className="h-10 w-full rounded-lg border border-input bg-card pr-3 pl-9 text-base outline-none placeholder:text-muted-foreground hover:border-foreground/20 focus:border-ring focus:ring-3 focus:ring-ring/50 md:text-sm"
      />
    </label>
  );

  const wealthNav = (
    <nav aria-label="Wealth views" className="flex min-w-0 rounded-lg bg-muted p-0.5">
      <Link
        href="/investments"
        aria-current={!showAccounts ? "page" : undefined}
        className={cn(
          "flex-1 rounded-md px-3 py-2 text-center text-xs font-semibold whitespace-nowrap outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
          !showAccounts ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
        )}
      >
        Portfolio
      </Link>
      <Link
        href="/investments?view=accounts"
        aria-current={showAccounts ? "page" : undefined}
        className={cn(
          "flex-1 rounded-md px-3 py-2 text-center text-xs font-semibold whitespace-nowrap outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
          showAccounts ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
        )}
      >
        Accounts
      </Link>
    </nav>
  );

  async function handleSignOut() {
    await signOut();
    router.replace("/login");
  }

  return (
    <header className="sticky top-0 z-40 px-2 pt-2 sm:px-4 sm:pt-3 lg:px-6 lg:pt-4">
      <div className="mx-auto max-w-[100rem] rounded-2xl border border-white/80 bg-card/85 p-2 shadow-card backdrop-blur-xl supports-[backdrop-filter]:bg-card/78">
        <div className="flex min-w-0 items-center gap-2">
          <AppLogo
            label={meta.title}
            copyClassName={showPeriod ? "hidden sm:block" : undefined}
            className="mr-auto lg:mr-1"
          />

          <nav aria-label="Primary" className="hidden min-w-0 flex-1 items-center justify-center gap-1 lg:flex">
            {PRIMARY_NAV_ITEMS.map((item) => {
              const active = isNavItemActive(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "rounded-lg px-3 py-2 text-sm font-semibold outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50",
                    active
                      ? "bg-foreground text-background"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  {item.label}
                </Link>
              );
            })}

            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <button
                    type="button"
                    className={cn(
                      "inline-flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-semibold outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50",
                      moreActive
                        ? "bg-foreground text-background"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground",
                    )}
                  />
                }
              >
                More
                <ChevronDown />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="center" sideOffset={10} className="w-56 p-1.5">
                <DropdownMenuGroup>
                  <DropdownMenuLabel>Workspace</DropdownMenuLabel>
                  {SECONDARY_NAV_ITEMS.map((item) => (
                    <DropdownMenuItem
                      key={item.href}
                      render={<Link href={item.href} />}
                      className="gap-2.5 px-2.5 py-2"
                    >
                      <item.icon />
                      {item.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  {session?.user.email ? (
                    <DropdownMenuLabel className="truncate normal-case">
                      {session.user.email}
                    </DropdownMenuLabel>
                  ) : null}
                  <DropdownMenuItem
                    variant="destructive"
                    onClick={handleSignOut}
                    className="gap-2.5 px-2.5 py-2"
                  >
                    <LogOut />
                    Sign out
                  </DropdownMenuItem>
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </nav>

          {showSearch ? <div className="hidden w-60 xl:block">{searchField}</div> : null}
          {showPeriod ? <CashflowPeriodControl /> : null}
          {showWealthNav ? <div className="hidden xl:block">{wealthNav}</div> : null}

          {addMode ? (
            <>
              <Button
                aria-label={ADD_LABEL[addMode]}
                onClick={() => setAddOpenFor(pathname)}
              >
                <Plus data-icon="inline-start" />
                <span className="hidden xl:inline">{ADD_LABEL[addMode]}</span>
              </Button>
              {addOpenFor === pathname ? (
                <AddTransactionDialog
                  mode={addMode}
                  open
                  onOpenChange={(open) => setAddOpenFor(open ? pathname : null)}
                />
              ) : null}
            </>
          ) : null}
        </div>

        {showSearch || showWealthNav ? (
          <div className="mt-2 xl:hidden">{showSearch ? searchField : wealthNav}</div>
        ) : null}
      </div>
    </header>
  );
}
