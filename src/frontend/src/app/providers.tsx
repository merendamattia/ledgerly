"use client";

import { useEffect, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import { PrivacyModeProvider } from "@/components/privacy-mode";
import { useSession } from "@/lib/auth-client";
import { clearLedgerQueryCache } from "@/lib/query-keys";

/** Owns the query cache for one authenticated session identity. */
function SessionProviders({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      }),
  );

  useEffect(() => () => clearLedgerQueryCache(queryClient), [queryClient]);

  return (
    <QueryClientProvider client={queryClient}>
      <PrivacyModeProvider>
        <TooltipProvider>{children}</TooltipProvider>
      </PrivacyModeProvider>
    </QueryClientProvider>
  );
}

/** Renders app-wide client providers for Query, privacy mode, and tooltips. */
export function Providers({ children }: { children: React.ReactNode }) {
  const { data: session, isPending } = useSession();
  const sessionKey = session?.user.id ?? (isPending ? "pending" : "anonymous");

  return <SessionProviders key={sessionKey}>{children}</SessionProviders>;
}
