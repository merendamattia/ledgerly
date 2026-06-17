import { AuthGuard } from "@/components/auth-guard";
import { AppBottomNav } from "@/components/app-bottom-nav";
import { AppTopbar } from "@/components/app-topbar";
import { SearchProvider } from "@/components/search-context";

// Authenticated app shell: topbar (logo + page) → content → bottom tab bar.
// No left sidebar; the bottom bar is the only navigation at every breakpoint.
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <SearchProvider>
        <div className="flex min-h-svh flex-col bg-background">
          <AppTopbar />
          {/* pb leaves room for the fixed bottom tab bar (present at all sizes). */}
          <main className="flex-1 p-4 pb-24 md:p-6 lg:p-8 lg:pb-24">{children}</main>
          <AppBottomNav />
        </div>
      </SearchProvider>
    </AuthGuard>
  );
}
