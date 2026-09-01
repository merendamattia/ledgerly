"use client";

import { useEffect, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NextIntlClientProvider } from "next-intl";
import { TooltipProvider } from "@/components/ui/tooltip";
import { PrivacyModeProvider } from "@/components/privacy-mode";
import { useSession } from "@/lib/auth-client";
import { clearLedgerQueryCache } from "@/lib/query-keys";
import { useSettings } from "@/hooks/use-settings";
import {
  DEFAULT_LOCALE,
  getMessages,
  isLocale,
  LOCALE_COOKIE,
  type Locale,
} from "@/i18n/config";
import { setFormatLocale } from "@/lib/format";

function LocaleProvider({
  children,
  initialLocale,
}: {
  children: React.ReactNode;
  initialLocale: Locale;
}) {
  const { data: session } = useSession();
  const canLoadSettings = !!session && !session.user.mustChangePassword;
  const settings = useSettings(canLoadSettings);
  const locale = isLocale(settings.data?.locale) ? settings.data.locale : initialLocale;

  useEffect(() => {
    setFormatLocale(locale);
    document.documentElement.lang = locale;
    document.cookie = `${LOCALE_COOKIE}=${locale}; Path=/; Max-Age=31536000; SameSite=Lax`;
  }, [locale]);

  return (
    <NextIntlClientProvider locale={locale} messages={getMessages(locale)}>
      {children}
    </NextIntlClientProvider>
  );
}

/** Owns the query cache for one authenticated session identity. */
function SessionProviders({
  children,
  initialLocale,
}: {
  children: React.ReactNode;
  initialLocale: Locale;
}) {
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

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      void navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    }
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <LocaleProvider initialLocale={initialLocale}>
        <PrivacyModeProvider>
          <TooltipProvider>{children}</TooltipProvider>
        </PrivacyModeProvider>
      </LocaleProvider>
    </QueryClientProvider>
  );
}

/** Renders app-wide client providers for Query, privacy mode, and tooltips. */
export function Providers({
  children,
  initialLocale = DEFAULT_LOCALE,
}: {
  children: React.ReactNode;
  initialLocale?: Locale;
}) {
  const { data: session, isPending } = useSession();
  const sessionKey = session?.user.id ?? (isPending ? "pending" : "anonymous");

  return (
    <SessionProviders key={sessionKey} initialLocale={initialLocale}>
      {children}
    </SessionProviders>
  );
}
