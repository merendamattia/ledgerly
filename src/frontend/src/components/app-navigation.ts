import type { ComponentType } from "react";
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
  label: string;
  shortLabel?: string;
  icon: ComponentType<{ className?: string }>;
};

export const PRIMARY_NAV_ITEMS = [
  { href: "/", label: "Overview", icon: LayoutGrid },
  { href: "/investments", label: "Wealth", icon: PieChart },
  { href: "/cashflow", label: "Cash flow", icon: ArrowLeftRight },
  { href: "/transactions", label: "Activity", icon: ListChecks },
] satisfies AppNavItem[];

export const SECONDARY_NAV_ITEMS = [
  { href: "/accounts", label: "Accounts", icon: Landmark },
  { href: "/matrix", label: "Matrices", icon: Table },
  { href: "/imports", label: "Imports", icon: Upload },
  { href: "/settings", label: "Settings", icon: Settings },
  { href: "/database", label: "Database", icon: Database },
  { href: "/dev", label: "Developer tools", shortLabel: "Dev", icon: Terminal },
] satisfies AppNavItem[];

/** Returns whether a navigation target represents the current route. */
export function isNavItemActive(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}
