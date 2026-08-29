"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { LogOut, MoreHorizontal } from "lucide-react";
import {
  PRIMARY_NAV_ITEMS,
  isNavItemActive,
  type AppNavItem,
  visibleSecondaryNavItems,
} from "@/components/app-navigation";
import { signOut, useSession } from "@/lib/auth-client";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

const TAB_CLASS =
  "group flex min-h-14 flex-1 flex-col items-center justify-center gap-1 rounded-xl px-1 py-1.5 outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring";

/** Renders the icon and label shared by mobile navigation controls. */
function TabInner({
  active,
  item,
}: {
  active: boolean;
  item: Pick<AppNavItem, "label" | "shortLabel" | "icon">;
}) {
  const Icon = item.icon;
  return (
    <>
      <span
        className={cn(
          "flex size-7 items-center justify-center rounded-lg transition-colors",
          active
            ? "bg-primary text-primary-foreground"
            : "text-sidebar-foreground group-hover:text-sidebar-accent-foreground",
        )}
      >
        <Icon className="size-[17px]" />
      </span>
      <span
        className={cn(
          "max-w-full truncate text-[10px] leading-none font-semibold",
          active ? "text-primary" : "text-sidebar-foreground",
        )}
      >
        {item.shortLabel ?? item.label}
      </span>
    </>
  );
}

/** Renders the smartphone navigation dock and its secondary-route sheet. */
export function AppBottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session } = useSession();
  const [open, setOpen] = useState(false);
  const secondaryNavItems = visibleSecondaryNavItems(session?.user.role);
  const moreActive = secondaryNavItems.some((item) =>
    isNavItemActive(pathname, item.href),
  );

  async function handleSignOut() {
    setOpen(false);
    await signOut();
    router.replace("/login");
  }

  return (
    <nav
      data-slot="app-bottom-nav"
      aria-label="Primary"
      className="fixed inset-x-3 bottom-3 z-40 rounded-2xl border border-sidebar-border bg-sidebar/95 px-1 pb-[calc(env(safe-area-inset-bottom)+0.25rem)] text-sidebar-foreground shadow-lg backdrop-blur-xl lg:hidden"
    >
      <ul className="flex items-stretch">
        {PRIMARY_NAV_ITEMS.map((item) => {
          const active = isNavItemActive(pathname, item.href);
          return (
            <li key={item.href} className="flex min-w-0 flex-1">
              <Link href={item.href} aria-current={active ? "page" : undefined} className={TAB_CLASS}>
                <TabInner active={active} item={item} />
              </Link>
            </li>
          );
        })}

        <li className="flex min-w-0 flex-1">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger
              render={<button type="button" aria-label="More" className={TAB_CLASS} />}
            >
              <TabInner
                active={moreActive}
                item={{ label: "More", icon: MoreHorizontal }}
              />
            </SheetTrigger>
            <SheetContent side="bottom" className="pb-safe overflow-y-auto">
              <SheetHeader>
                <SheetTitle>More</SheetTitle>
                {session?.user.email ? (
                  <p className="truncate text-xs text-muted-foreground">{session.user.email}</p>
                ) : null}
              </SheetHeader>
              <div className="flex flex-col gap-1 px-2 pb-3">
                {secondaryNavItems.map((item) => {
                  const active = isNavItemActive(pathname, item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setOpen(false)}
                      className={cn(
                        "flex min-h-11 items-center gap-3 rounded-lg px-3 py-2 text-sm font-semibold outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50",
                        active ? "bg-accent text-accent-foreground" : "hover:bg-muted",
                      )}
                    >
                      <item.icon className="size-4 text-muted-foreground" />
                      {item.label}
                    </Link>
                  );
                })}
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="flex min-h-11 items-center gap-3 rounded-lg px-3 py-2 text-sm font-semibold text-destructive-ink outline-none transition-colors hover:bg-destructive/10 focus-visible:ring-3 focus-visible:ring-destructive/30"
                >
                  <LogOut className="size-4" />
                  Sign out
                </button>
              </div>
            </SheetContent>
          </Sheet>
        </li>
      </ul>
    </nav>
  );
}
