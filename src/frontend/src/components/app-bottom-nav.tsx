"use client";

import Link from "next/link";
import { useState, type ComponentType } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutGrid,
  PieChart,
  ArrowLeftRight,
  ListChecks,
  MoreHorizontal,
  Upload,
  Settings,
  Database,
  Terminal,
  LogOut,
} from "lucide-react";
import { signOut, useSession } from "@/lib/auth-client";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

// The app's only navigation, on every screen size. Four main sections plus a
// "More" tab that opens a bottom sheet with the admin links (no left drawer).
const TABS = [
  { href: "/", label: "Overview", icon: LayoutGrid },
  { href: "/investments", label: "Invest", icon: PieChart },
  { href: "/cashflow", label: "Cash flow", icon: ArrowLeftRight },
  { href: "/transactions", label: "Activity", icon: ListChecks },
] as const;

const MORE_LINKS = [
  { href: "/imports", label: "Imports", icon: Upload },
  { href: "/settings", label: "Settings", icon: Settings },
  { href: "/database", label: "Database", icon: Database },
  { href: "/dev", label: "Dev", icon: Terminal },
] as const;

function isActive(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

const TAB_CLASS =
  "group flex flex-1 flex-col items-center gap-1 px-1 pt-2 pb-2.5 outline-none";

function TabInner({
  active,
  icon: Icon,
  label,
}: {
  active: boolean;
  icon: ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <>
      <span
        className={cn(
          "flex h-7 w-12 items-center justify-center rounded-full transition-colors",
          active
            ? "bg-primary text-primary-foreground"
            : "text-muted-foreground group-hover:text-foreground",
        )}
      >
        <Icon className="size-[18px]" />
      </span>
      <span
        className={cn(
          "text-[11px] leading-none font-medium transition-colors",
          active ? "text-foreground" : "text-muted-foreground",
        )}
      >
        {label}
      </span>
    </>
  );
}

export function AppBottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session } = useSession();
  const [open, setOpen] = useState(false);

  const email = session?.user.email ?? "";
  const moreActive = MORE_LINKS.some((l) => pathname.startsWith(l.href));

  async function handleSignOut() {
    setOpen(false);
    await signOut();
    router.replace("/login");
  }

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 pb-[calc(env(safe-area-inset-bottom)+0.625rem)] backdrop-blur-md"
    >
      <ul className="mx-auto flex max-w-2xl items-stretch">
        {TABS.map((tab) => {
          const active = isActive(pathname, tab.href);
          return (
            <li key={tab.href} className="flex-1">
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={TAB_CLASS}
              >
                <TabInner active={active} icon={tab.icon} label={tab.label} />
              </Link>
            </li>
          );
        })}

        <li className="flex-1">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger render={<button type="button" aria-label="More" className={TAB_CLASS} />}>
              <TabInner active={moreActive} icon={MoreHorizontal} label="More" />
            </SheetTrigger>
            <SheetContent side="bottom" className="pb-safe rounded-t-[var(--card-radius)]">
              <SheetHeader>
                <SheetTitle>Menu</SheetTitle>
                {email ? <p className="truncate text-xs text-muted-foreground">{email}</p> : null}
              </SheetHeader>
              <div className="flex flex-col gap-0.5 px-2 pb-2">
                {MORE_LINKS.map((l) => {
                  const active = pathname.startsWith(l.href);
                  return (
                    <Link
                      key={l.href}
                      href={l.href}
                      onClick={() => setOpen(false)}
                      className={cn(
                        "flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium transition-colors",
                        active ? "bg-muted text-foreground" : "text-foreground hover:bg-muted",
                      )}
                    >
                      <l.icon className="size-4 text-muted-foreground" />
                      {l.label}
                    </Link>
                  );
                })}
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium text-destructive transition-colors hover:bg-destructive/10"
                >
                  <LogOut className="size-4" />
                  Logout
                </button>
              </div>
            </SheetContent>
          </Sheet>
        </li>
      </ul>
    </nav>
  );
}
