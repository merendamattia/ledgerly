import type { ReactNode } from "react";

/** Renders a consistent page title block with an optional right-aligned action. */
export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-wrap items-start justify-between gap-4">
      <div className="flex min-w-0 flex-col gap-1.5">
        <h1 className="font-display text-[1.65rem] leading-tight font-semibold tracking-[-0.025em]">
          {title}
        </h1>
        {description ? (
          <p className="max-w-[70ch] text-sm leading-relaxed text-muted-foreground text-pretty">
            {description}
          </p>
        ) : null}
      </div>
      {action}
    </div>
  );
}
