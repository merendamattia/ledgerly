"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Search, Settings } from "lucide-react";
import { useSession } from "@/lib/auth-client";
import { useSearch } from "@/components/search-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SidebarTrigger } from "@/components/ui/sidebar";

function initials(email: string): string {
  const name = email.split("@")[0] ?? "";
  const parts = name.split(/[._-]+/).filter(Boolean);
  const letters = parts.length >= 2 ? parts[0][0] + parts[1][0] : name.slice(0, 2);
  return letters.toUpperCase() || "U";
}

export function AppTopbar() {
  const pathname = usePathname();
  const { query, setQuery } = useSearch();
  const { data: session } = useSession();
  const email = session?.user.email ?? "";
  const showSearch = pathname.startsWith("/expenses");

  return (
    <header className="flex h-16 items-center gap-3 border-b bg-card px-4 md:px-6">
      <SidebarTrigger className="md:hidden" />

      {showSearch ? (
        <div className="relative w-full max-w-sm">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search transactions…"
            className="h-9 pl-9"
          />
        </div>
      ) : (
        <div className="flex-1" />
      )}

      <div className="ml-auto flex items-center gap-1.5">
        <Button variant="ghost" size="icon" nativeButton={false} render={<Link href="/settings" />}>
          <Settings />
          <span className="sr-only">Settings</span>
        </Button>
        <div className="flex size-8 items-center justify-center rounded-full bg-accent text-xs font-semibold text-accent-foreground">
          {email ? initials(email) : "U"}
        </div>
      </div>
    </header>
  );
}
