import type { ReactNode } from "react";

/** Keeps period insights above the movement/sidebar grid at every viewport. */
export function TransactionContentLayout({
  summary,
  sidebar,
  movements,
}: {
  summary: ReactNode | null;
  sidebar: ReactNode;
  movements: ReactNode;
}) {
  const hasSummary = summary !== null && summary !== undefined;

  return (
    <div className="grid min-w-0 grid-cols-1 gap-5 lg:grid-cols-12">
      {hasSummary ? (
        <section
          aria-label="Period summary"
          className="min-w-0 lg:col-span-12 lg:col-start-1 lg:row-start-1"
        >
          {summary}
        </section>
      ) : null}
      <div
        className={`min-w-0 lg:col-span-9 lg:col-start-1 ${hasSummary ? "lg:row-start-2" : "lg:row-start-1"}`}
      >
        {movements}
      </div>
      <aside
        className={`min-w-0 lg:sticky lg:top-4 lg:self-start lg:col-span-3 lg:col-start-10 ${hasSummary ? "lg:row-start-2" : "lg:row-start-1"}`}
      >
        {sidebar}
      </aside>
    </div>
  );
}
