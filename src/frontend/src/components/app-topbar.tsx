"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Search } from "lucide-react";
import { useSearch } from "@/components/search-context";
import { AddTransactionDialog, type AddMode } from "@/components/add-transaction-dialog";
import { ImportInvestmentTransactionsDialog } from "@/components/import-investment-transactions-dialog";
import { ImportTransactionsDialog } from "@/components/import-transactions-dialog";
import { Button } from "@/components/ui/button";

// Lime logo tile + ledger glyph, mirrored from the old sidebar header.
function Logo() {
  return (
    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M5 3.5h14M5 12h14M5 20.5h14"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
        />
        <circle cx="9" cy="3.5" r="2" fill="currentColor" />
        <circle cx="16" cy="12" r="2" fill="currentColor" />
        <circle cx="11" cy="20.5" r="2" fill="currentColor" />
      </svg>
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

const ADD_LABEL: Record<AddMode, string> = {
  full: "Add transaction",
  cashflow: "Add expense",
  investment: "Add investment",
};

export function AppTopbar() {
  const pathname = usePathname();
  const { query, setQuery } = useSearch();
  const meta = metaFor(pathname);
  const showSearch = pathname.startsWith("/transactions");
  const addMode = addModeFor(pathname);
  // A CSV dropped inside the Add drawer is handed off to the matching import
  // flow: investment movements vs. income/expense transactions.
  const [importOpen, setImportOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);

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

          {addMode ? (
            <AddTransactionDialog
              mode={addMode}
              onImportFile={(file) => {
                setImportFile(file);
                setImportOpen(true);
              }}
              trigger={
                <Button className="gap-1.5">
                  <span className="text-base leading-none">+</span>
                  <span className="hidden sm:inline">{ADD_LABEL[addMode]}</span>
                  <span className="sr-only sm:hidden">{ADD_LABEL[addMode]}</span>
                </Button>
              }
            />
          ) : null}

        {addMode === "investment" ? (
          <ImportInvestmentTransactionsDialog
            open={importOpen}
            onOpenChange={(o) => {
              setImportOpen(o);
              if (!o) setImportFile(null);
            }}
            initialFile={importFile}
          />
        ) : addMode === "full" || addMode === "cashflow" ? (
          <ImportTransactionsDialog
            open={importOpen}
            onOpenChange={(o) => {
              setImportOpen(o);
              if (!o) setImportFile(null);
            }}
            initialFile={importFile}
          />
        ) : null}
        </div>
      </div>

      {/* On phones the search drops to a full-width row instead of vanishing. */}
      {showSearch ? <div className="mt-3 sm:hidden">{searchField}</div> : null}
    </header>
  );
}
