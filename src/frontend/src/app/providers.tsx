"use client";

import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import { PrivacyModeProvider } from "@/components/privacy-mode";

/** Renders app-wide client providers for Query, privacy mode, and tooltips. */
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
