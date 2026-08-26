import type { ReactNode } from "react";

/** Keeps the period summary first on narrow screens while placing it in the desktop sidebar. */
export function TransactionContentLayout({
  summary,
  sidebar,
  movements,
  summaryFirstOnMobile = summary !== null && summary !== undefined,
}: {
  summary: ReactNode | null;
  sidebar: ReactNode;
  movements: ReactNode;
  summaryFirstOnMobile?: boolean;
}) {
  const hasSummary = summary !== null && summary !== undefined;
  const showSummaryFirst = hasSummary && summaryFirstOnMobile;

  return (
    <div className="grid min-w-0 grid-cols-1 gap-5 lg:grid-cols-12">
      <div
        className={`min-w-0 ${showSummaryFirst ? "order-2" : "order-1"} lg:order-none lg:col-span-9 lg:col-start-1 lg:row-start-1`}
      >
        {movements}
      </div>
      <div className="contents lg:sticky lg:top-4 lg:col-span-3 lg:col-start-10 lg:row-start-1 lg:flex lg:min-w-0 lg:flex-col lg:gap-5">
        {hasSummary ? (
          <section
            aria-label="Period summary"
            className={`min-w-0 ${showSummaryFirst ? "order-1" : "order-2"} lg:order-none`}
          >
            {summary}
          </section>
        ) : null}
        <aside className={`min-w-0 ${showSummaryFirst ? "order-3" : "order-2"} lg:order-none`}>
          {sidebar}
        </aside>
      </div>
    </div>
  );
}
