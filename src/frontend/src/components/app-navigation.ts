import type { ComponentType } from "react";
import type { Messages } from "@/i18n/config";
import {
  ArrowLeftRight,
  Database,
  Landmark,
  LayoutGrid,
  ListChecks,
  PieChart,
  Settings,
  Table,
  Terminal,
  Upload,
} from "lucide-react";

export type AppNavItem = {
  href: string;
  labelKey: keyof Messages["nav"];
  shortLabelKey?: keyof Messages["nav"];
  icon: ComponentType<{ className?: string }>;
  adminOnly?: boolean;
};

export const PRIMARY_NAV_ITEMS: AppNavItem[] = [
  { href: "/", labelKey: "overview", icon: LayoutGrid },
  { href: "/investments", labelKey: "wealth", icon: PieChart },
  { href: "/cashflow", labelKey: "cashFlow", icon: ArrowLeftRight },
  { href: "/transactions", labelKey: "activity", icon: ListChecks },
];

export const SECONDARY_NAV_ITEMS: AppNavItem[] = [
  { href: "/accounts", labelKey: "accounts", icon: Landmark },
  { href: "/matrix", labelKey: "matrices", icon: Table },
  { href: "/imports", labelKey: "imports", icon: Upload },
  { href: "/settings", labelKey: "settings", icon: Settings },
  { href: "/database", labelKey: "database", icon: Database, adminOnly: true },
  { href: "/dev", labelKey: "developerTools", shortLabelKey: "dev", icon: Terminal, adminOnly: true },
];

/** Returns the secondary navigation available to the current account role. */
export function visibleSecondaryNavItems(role?: string): AppNavItem[] {
  return SECONDARY_NAV_ITEMS.filter((item) => !item.adminOnly || role === "admin");
}

/** Returns whether a navigation target represents the current route. */
export function isNavItemActive(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}
