"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

type SearchState = { query: string; setQuery: (q: string) => void };

const SearchContext = createContext<SearchState | null>(null);

// App-wide transient search term. The topbar writes it; pages (e.g. the
// Transactions list) read it to filter their own data. Not persisted.
export function SearchProvider({ children }: { children: ReactNode }) {
  const [query, setQuery] = useState("");
  return <SearchContext value={{ query, setQuery }}>{children}</SearchContext>;
}

export function useSearch(): SearchState {
  const ctx = useContext(SearchContext);
  if (!ctx) throw new Error("useSearch must be used within a SearchProvider");
  return ctx;
}
