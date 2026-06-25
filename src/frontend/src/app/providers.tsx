"use client";

import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import { PrivacyModeProvider } from "@/components/privacy-mode";

// App-wide client providers: TanStack Query for server state and the shared
// tooltip provider for shadcn tooltips.
export function Providers({ children }: { children: React.ReactNode }) {
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

  return (
    <QueryClientProvider client={queryClient}>
      <PrivacyModeProvider>
        <TooltipProvider>{children}</TooltipProvider>
      </PrivacyModeProvider>
    </QueryClientProvider>
  );
}
