import type { ReactNode } from "react";

/** Keeps the period summary first on narrow screens while placing it in the desktop sidebar. */
export function TransactionContentLayout({
  summary,
  movements,
}: {
  summary: ReactNode;
  movements: ReactNode;
}) {
  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
      <aside className="min-w-0 lg:col-span-3 lg:col-start-10 lg:row-start-1">{summary}</aside>
      <div className="min-w-0 lg:col-span-9 lg:col-start-1 lg:row-start-1">{movements}</div>
    </div>
  );
}
