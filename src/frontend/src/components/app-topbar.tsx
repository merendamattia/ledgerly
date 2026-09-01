"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronDown, LogOut, Plus, Search } from "lucide-react";
import { AppLogo } from "@/components/app-logo";
import {
  PRIMARY_NAV_ITEMS,
  isNavItemActive,
  visibleSecondaryNavItems,
} from "@/components/app-navigation";
import { useSearch } from "@/components/search-context";
import {
  SEGMENTED_CONTROL_ACTIVE_CLASS,
  SEGMENTED_CONTROL_CLASS,
  SEGMENTED_CONTROL_INACTIVE_CLASS,
  SEGMENTED_CONTROL_ITEM_CLASS,
} from "@/components/segmented-control";
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
import { clearLedgerQueryCache } from "@/lib/query-keys";
import { cn } from "@/lib/utils";
import { NotificationCenter } from "@/components/notification-center";
import type { Messages } from "@/i18n/config";

const AddTransactionDialog = dynamic(
  () => import("@/components/add-transaction-dialog").then((mod) => mod.AddTransactionDialog),
  { ssr: false },
);

type PageMeta = {
  titleKey?: keyof Messages["nav"];
  subtitleKey: keyof Messages["pageMeta"];
};

const PAGE_META: Record<string, PageMeta> = {
  "/": { titleKey: "overview", subtitleKey: "overviewSubtitle" },
  "/investments": { titleKey: "wealth", subtitleKey: "wealthSubtitle" },
  "/cashflow": { titleKey: "cashFlow", subtitleKey: "cashFlowSubtitle" },
  "/transactions": { titleKey: "activity", subtitleKey: "activitySubtitle" },
  "/accounts": { titleKey: "accounts", subtitleKey: "accountsSubtitle" },
  "/matrix": { titleKey: "matrices", subtitleKey: "matricesSubtitle" },
  "/imports": { titleKey: "imports", subtitleKey: "importsSubtitle" },
  "/settings": { titleKey: "settings", subtitleKey: "settingsSubtitle" },
  "/database": { titleKey: "database", subtitleKey: "databaseSubtitle" },
  "/dev": { titleKey: "developerTools", subtitleKey: "developerToolsSubtitle" },
};

/** Returns the metadata for the current route. */
function metaFor(pathname: string): PageMeta {
  if (pathname === "/") return PAGE_META["/"];
  const route = Object.keys(PAGE_META).find(
    (candidate) => candidate !== "/" && pathname.startsWith(candidate),
  );
  return route ? PAGE_META[route] : { subtitleKey: "fallbackSubtitle" };
}

/** Resolves the contextual creation mode for the current route. */
function addModeFor(pathname: string): AddMode | null {
  if (pathname.startsWith("/transactions")) return "full";
  if (pathname.startsWith("/cashflow")) return "cashflow";
  if (pathname.startsWith("/investments")) return "investment";
  return null;
}

const ADD_LABEL_KEY: Record<AddMode, keyof Messages["nav"]> = {
  full: "addTransaction",
  cashflow: "addExpense",
  investment: "addInvestment",
};

/** Renders the cash-flow period selector backed by the shared provider. */
function CashflowPeriodControl() {
  const t = useTranslations("cashflow");
  const { period, setPeriod } = useCashflowPeriod();
  const resolved = resolvePeriod(period);
  const label = period === "this-year" ? t("thisYear") : period === "12m" ? t("last12Months") : resolved.label;
  const options = periodOptions().map((option) => ({
    ...option,
    label: option.value === "this-year" ? t("thisYear") : option.value === "12m" ? t("last12Months") : option.label,
  }));
  return (
    <PeriodPicker
      value={period}
      label={label}
      options={options}
      onChange={setPeriod}
      triggerClassName="max-w-full sm:max-w-56 lg:w-auto lg:max-w-44"
    />
  );
}

/** Renders the sticky adaptive app header and desktop navigation. */
export function AppTopbar() {
  const nav = useTranslations("nav");
  const pageMeta = useTranslations("pageMeta");
  const common = useTranslations("common");
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  const { query, setQuery } = useSearch();
  const [addOpenFor, setAddOpenFor] = useState<string | null>(null);
  const metaKeys = metaFor(pathname);
  const meta = {
    title: metaKeys.titleKey ? nav(metaKeys.titleKey) : common("appName"),
    subtitle: pageMeta(metaKeys.subtitleKey),
  };
  const showSearch = pathname.startsWith("/transactions");
  const showPeriod = pathname.startsWith("/cashflow");
  const showWealthNav = pathname.startsWith("/investments");
  const showAccounts = searchParams.get("view") === "accounts";
  const addMode = addModeFor(pathname);
  const secondaryNavItems = visibleSecondaryNavItems(session?.user.role);
  const moreActive = secondaryNavItems.some((item) =>
    isNavItemActive(pathname, item.href),
  );

  const searchField = (
    <label className="relative block min-w-0">
      <span className="sr-only">{nav("searchTransactions")}</span>
      <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
      <input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={nav("searchTransactionsPlaceholder")}
        className="h-10 w-full rounded-lg border border-input bg-card pr-3 pl-9 text-base outline-none placeholder:text-muted-foreground hover:border-foreground/20 focus:border-ring focus:ring-3 focus:ring-ring/50 md:text-sm"
      />
    </label>
  );

  const wealthNav = (
    <nav aria-label={nav("wealthViews")} className={cn(SEGMENTED_CONTROL_CLASS, "flex min-w-0")}>
      <Link
        href="/investments"
        aria-current={!showAccounts ? "page" : undefined}
        className={cn(
          SEGMENTED_CONTROL_ITEM_CLASS,
          !showAccounts ? SEGMENTED_CONTROL_ACTIVE_CLASS : SEGMENTED_CONTROL_INACTIVE_CLASS,
        )}
      >
        {nav("portfolio")}
      </Link>
      <Link
        href="/investments?view=accounts"
        aria-current={showAccounts ? "page" : undefined}
        className={cn(
          SEGMENTED_CONTROL_ITEM_CLASS,
          showAccounts ? SEGMENTED_CONTROL_ACTIVE_CLASS : SEGMENTED_CONTROL_INACTIVE_CLASS,
        )}
      >
        {nav("accounts")}
      </Link>
    </nav>
  );

  async function handleSignOut() {
    await signOut();
    clearLedgerQueryCache(queryClient);
    router.replace("/login");
  }

  return (
    <header className="sticky top-0 z-40 px-2 pt-2 sm:px-4 sm:pt-3 lg:px-6 lg:pt-4">
      <div className="mx-auto max-w-[100rem] rounded-2xl border border-white/80 bg-card/85 p-2 shadow-card backdrop-blur-xl supports-[backdrop-filter]:bg-card/78">
        <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
          <AppLogo label={meta.title} className="min-w-0 justify-self-start" />

          <nav aria-label={nav("primary")} className="hidden min-w-0 items-center justify-center gap-1 lg:col-start-2 lg:flex">
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
                  {nav(item.labelKey)}
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
                {nav("more")}
                <ChevronDown />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="center" sideOffset={10} className="w-56 p-1.5">
                <DropdownMenuGroup>
                  <DropdownMenuLabel>{nav("workspace")}</DropdownMenuLabel>
                  {secondaryNavItems.map((item) => (
                    <DropdownMenuItem
                      key={item.href}
                      render={<Link href={item.href} />}
                      className="gap-2.5 px-2.5 py-2"
                    >
                      <item.icon />
                      {nav(item.labelKey)}
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
                    {nav("signOut")}
                  </DropdownMenuItem>
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </nav>

          <div className="flex min-w-0 items-center justify-self-end gap-2 lg:col-start-3">
            {showSearch ? <div className="hidden w-60 xl:block">{searchField}</div> : null}
            {showPeriod ? <div className="hidden lg:block"><CashflowPeriodControl /></div> : null}
            {showWealthNav ? <div className="hidden xl:block">{wealthNav}</div> : null}
            <NotificationCenter />

            {addMode ? (
              <>
              <Button
                aria-label={nav(ADD_LABEL_KEY[addMode])}
                onClick={() => setAddOpenFor(pathname)}
              >
                <Plus data-icon="inline-start" />
                <span className="hidden xl:inline">{nav(ADD_LABEL_KEY[addMode])}</span>
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
        </div>

        {showPeriod ? <div className="mt-2 lg:hidden"><CashflowPeriodControl /></div> : null}

        {showSearch || showWealthNav ? (
          <div className="mt-2 xl:hidden">{showSearch ? searchField : wealthNav}</div>
        ) : null}
      </div>
    </header>
  );
}
