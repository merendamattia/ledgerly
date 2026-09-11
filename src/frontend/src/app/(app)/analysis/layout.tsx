import type { Metadata } from "next";
import { cookies } from "next/headers";
import { DEFAULT_LOCALE, getMessages, isLocale, LOCALE_COOKIE } from "@/i18n/config";

/** Supplies localized browser metadata for the Analysis route. */
export async function generateMetadata(): Promise<Metadata> {
  const hint = (await cookies()).get(LOCALE_COOKIE)?.value;
  const messages = getMessages(isLocale(hint) ? hint : DEFAULT_LOCALE);
  return {
    title: `${messages.analysis.title} — ${messages.common.appName}`,
    description: messages.analysis.description,
  };
}

export default function AnalysisLayout({ children }: { children: React.ReactNode }) {
  return children;
}
