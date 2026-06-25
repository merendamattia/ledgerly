"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

type SearchState = { query: string; setQuery: (q: string) => void };

const SearchContext = createContext<SearchState | null>(null);

/**
 * Provides the app-wide transient search term.
 *
 * The topbar writes it and pages such as the transactions list read it to
 * filter their own data. The value is intentionally not persisted.
 */
export function SearchProvider({ children }: { children: ReactNode }) {
  const [query, setQuery] = useState("");
  return <SearchContext value={{ query, setQuery }}>{children}</SearchContext>;
}

/** Reads the current app-wide search state. */
export function useSearch(): SearchState {
  const ctx = useContext(SearchContext);
  if (!ctx) throw new Error("useSearch must be used within a SearchProvider");
  return ctx;
}
