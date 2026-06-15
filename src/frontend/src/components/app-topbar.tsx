"use client";

import { usePathname } from "next/navigation";
import { Search } from "lucide-react";
import { useSearch } from "@/components/search-context";
import { AddTransactionDialog, type AddMode } from "@/components/add-transaction-dialog";
import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";

type PageMeta = { title: string; subtitle: string };

const PAGE_META: Record<string, PageMeta> = {
  "/": { title: "Overview", subtitle: "An at-a-glance view of your wealth" },
  "/investments": {
    title: "Assets & Investments",
    subtitle: "Portfolio, performance and allocation",
  },
  "/cashflow": { title: "Expenses & Cash Flow", subtitle: "Income, spending and monthly flows" },
  "/transactions": { title: "Transactions", subtitle: "All your recent movements" },
};

// Admin pages (settings, database, accounts) render their own PageHeader, so the
// topbar leaves the title slot empty for them.
function metaFor(pathname: string): PageMeta | null {
  if (pathname === "/") return PAGE_META["/"];
  const match = Object.keys(PAGE_META).find((p) => p !== "/" && pathname.startsWith(p));
  return match ? PAGE_META[match] : null;
}

// The "+ Add" button is contextual: it only appears on the three sections that
// can create something, and each scopes what can be added.
function addModeFor(pathname: string): AddMode | null {
  if (pathname.startsWith("/transactions")) return "full";
  if (pathname.startsWith("/cashflow")) return "cashflow";
  if (pathname.startsWith("/investments")) return "investment";
  return null;
}

export function AppTopbar() {
  const pathname = usePathname();
  const { query, setQuery } = useSearch();
  const meta = metaFor(pathname);
  const showSearch = pathname.startsWith("/transactions");
  const addMode = addModeFor(pathname);

  return (
    <header className="sticky top-0 z-10 flex items-center justify-between gap-6 border-b bg-background/80 px-4 py-4 backdrop-blur-md md:px-8">
      <div className="flex items-center gap-3">
        <SidebarTrigger className="md:hidden" />
        {meta ? (
          <div>
            <h1 className="font-display text-xl font-semibold tracking-tight md:text-2xl">
              {meta.title}
            </h1>
            {meta.subtitle ? (
              <p className="mt-0.5 text-sm text-muted-foreground">{meta.subtitle}</p>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="flex items-center gap-3">
        {showSearch ? (
          <div className="relative hidden w-[230px] sm:block">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search transactions…"
              className="h-10 w-full rounded-xl border bg-card pr-3 pl-9 text-sm outline-none placeholder:text-muted-foreground focus:border-ring"
            />
          </div>
        ) : null}

        {addMode ? (
          <AddTransactionDialog
            mode={addMode}
            trigger={
              <Button className="h-10 gap-1.5 rounded-xl px-4">
                <span className="text-base leading-none">+</span>
                Add
              </Button>
            }
          />
        ) : null}
      </div>
    </header>
  );
}
