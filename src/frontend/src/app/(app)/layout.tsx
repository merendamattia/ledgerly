import { AuthGuard } from "@/components/auth-guard";
import { AppBottomNav } from "@/components/app-bottom-nav";
import { AppTopbar } from "@/components/app-topbar";
import { SearchProvider } from "@/components/search-context";
import { CashflowPeriodProvider } from "@/components/cashflow/period-context";

/**
 * Renders the authenticated app shell with topbar, content, and bottom navigation.
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <SearchProvider>
        <CashflowPeriodProvider>
          <div className="flex min-h-svh flex-col">
            <a
              href="#main-content"
              className="sr-only fixed top-2 left-2 z-50 rounded-lg bg-foreground px-3 py-2 text-background focus:not-sr-only"
            >
              Skip to content
            </a>
            <AppTopbar />
            <main
              id="main-content"
              className="mx-auto w-full max-w-[100rem] flex-1 p-3 pb-28 sm:p-4 sm:pb-28 lg:p-6 lg:pb-8 xl:p-8"
            >
              {children}
            </main>
            <AppBottomNav />
          </div>
        </CashflowPeriodProvider>
      </SearchProvider>
    </AuthGuard>
  );
}
