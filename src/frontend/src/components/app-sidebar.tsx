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

  async function handleSignOut() {
    await signOut();
    router.replace("/login");
  }

  return (
    <Sidebar>
      <SidebarHeader>
        <div className="flex items-center gap-2.5 px-2 py-2">
          <div className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
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
          </div>
          <span className="font-display text-xl font-bold tracking-tight text-sidebar-accent-foreground">
            Ledgerly
          </span>
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
              render={
                <Link href="/settings">
                  <Settings />
                  <span>Settings</span>
                </Link>
              }
            />
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={handleSignOut}>
              <LogOut />
              <span>Logout</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        <SidebarSeparator />
        <div className="flex items-center gap-2.5 px-2 py-1.5">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#3a3b30] font-display text-sm font-semibold text-primary">
            {email ? initials(email) : "U"}
          </div>
          <span className="min-w-0 flex-1 truncate text-xs text-sidebar-accent-foreground">
            {email || "Account"}
          </span>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
