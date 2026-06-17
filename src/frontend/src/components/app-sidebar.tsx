"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutGrid,
  PieChart,
  ArrowLeftRight,
  ListChecks,
  Database,
  Terminal,
  Settings,
  LogOut,
  PanelLeftClose,
} from "lucide-react";
import { signOut, useSession } from "@/lib/auth-client";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
  useSidebar,
} from "@/components/ui/sidebar";

type NavItem = {
  href: string;
  label: string;
  icon: typeof LayoutGrid;
  disabled?: boolean;
};

const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Overview", icon: LayoutGrid },
  { href: "/investments", label: "Assets & Investments", icon: PieChart },
  { href: "/cashflow", label: "Expenses & Cash Flow", icon: ArrowLeftRight },
  { href: "/transactions", label: "Transactions", icon: ListChecks },
];

function isActive(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

function initials(email: string): string {
  const name = email.split("@")[0] ?? "";
  const parts = name.split(/[._-]+/).filter(Boolean);
  const letters = parts.length >= 2 ? parts[0][0] + parts[1][0] : name.slice(0, 2);
  return letters.toUpperCase() || "U";
}

export function AppSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session } = useSession();
  const email = session?.user.email ?? "";
  const { toggleSidebar } = useSidebar();

  async function handleSignOut() {
    await signOut();
    router.replace("/login");
  }

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex items-center gap-2.5 px-2 py-2 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0">
          <button
            type="button"
            onClick={toggleSidebar}
            aria-label="Toggle sidebar"
            title="Toggle sidebar"
            className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground transition-transform hover:scale-[1.05] group-data-[collapsible=icon]:size-8"
          >
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
          </button>
          <span className="min-w-0 flex-1 truncate font-display text-xl font-bold tracking-tight text-sidebar-accent-foreground group-data-[collapsible=icon]:hidden">
            Ledgerly
          </span>
          <button
            type="button"
            onClick={toggleSidebar}
            aria-label="Collapse sidebar"
            className="flex size-7 shrink-0 items-center justify-center rounded-md text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground group-data-[collapsible=icon]:hidden"
          >
            <PanelLeftClose className="size-4" />
          </button>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Finance</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-1">
              {NAV_ITEMS.map((item) =>
                item.disabled ? (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      disabled
                      tooltip="Coming soon"
                      className="cursor-not-allowed"
                    >
                      <item.icon />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ) : (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      isActive={isActive(pathname, item.href)}
                      tooltip={item.label}
                      render={
                        <Link href={item.href}>
                          <item.icon />
                          <span>{item.label}</span>
                        </Link>
                      }
                    />
                  </SidebarMenuItem>
                ),
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu className="gap-1">
          <SidebarMenuItem>
            <SidebarMenuButton
              isActive={isActive(pathname, "/dev")}
              tooltip="Dev"
              render={
                <Link href="/dev">
                  <Terminal />
                  <span>Dev</span>
                </Link>
              }
            />
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              isActive={isActive(pathname, "/database")}
              tooltip="Database"
              render={
                <Link href="/database">
                  <Database />
                  <span>Database</span>
                </Link>
              }
            />
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              isActive={isActive(pathname, "/settings")}
              tooltip="Settings"
              render={
                <Link href="/settings">
                  <Settings />
                  <span>Settings</span>
                </Link>
              }
            />
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={handleSignOut} tooltip="Logout">
              <LogOut />
              <span>Logout</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        <SidebarSeparator className="group-data-[collapsible=icon]:hidden" />
        <div className="flex items-center gap-2.5 px-2 py-1.5 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#3a3b30] font-display text-sm font-semibold text-primary group-data-[collapsible=icon]:size-8">
            {email ? initials(email) : "U"}
          </div>
          <span className="min-w-0 flex-1 truncate text-xs text-sidebar-accent-foreground group-data-[collapsible=icon]:hidden">
            {email || "Account"}
          </span>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
