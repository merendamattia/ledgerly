import { AuthGuard } from "@/components/auth-guard";
import { AppSidebar } from "@/components/app-sidebar";
import { AppTopbar } from "@/components/app-topbar";
import { SearchProvider } from "@/components/search-context";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

// Layout for the authenticated app: sidebar navigation + protected content.
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <SearchProvider>
        <SidebarProvider>
          <AppSidebar />
          <SidebarInset className="bg-background">
            <AppTopbar />
            <main className="flex-1 p-4 md:p-6 lg:p-8">{children}</main>
          </SidebarInset>
        </SidebarProvider>
      </SearchProvider>
    </AuthGuard>
  );
}
