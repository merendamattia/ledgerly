import en from "./messages/en.json";
import it from "./messages/it.json";

export const LOCALES = ["en", "it"] as const;
export const DEFAULT_LOCALE = "en" as const;
export const LOCALE_COOKIE = "ledgerly-locale";

export type Locale = (typeof LOCALES)[number];
export type Messages = typeof en;

const catalogs = { en, it } as const;

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && LOCALES.some((locale) => locale === value);
}

function merge<T extends Record<string, unknown>>(fallback: T, messages: Record<string, unknown>): T {
  return Object.fromEntries(
    Object.entries(fallback).map(([key, value]) => {
      const translated = messages[key];
      if (value && typeof value === "object" && !Array.isArray(value)) {
        return [key, merge(value as Record<string, unknown>, (translated ?? {}) as Record<string, unknown>)];
      }
      return [key, translated ?? value];
    }),
  ) as T;
}

/** Returns a complete catalog, filling missing locale entries from English. */
export function getMessages(locale: Locale): Messages {
  return locale === DEFAULT_LOCALE ? en : merge(en, catalogs[locale]);
}
