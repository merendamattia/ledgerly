# Frontend components — guide for Claude

> **ALWAYS, before any task: review ALL available skills and use the relevant ones**
> (`shadcn`, `tanstack-query`, `frontend-design`, `ui-ux-pro-max`). There may be a skill that
> solves the problem better.

## Reuse before you create
Check this folder (and `ui/`) before writing new markup. Compose existing pieces:
- `ui/` — shadcn/ui primitives (**Base UI** based: use the `render` prop, not `asChild`).
- `page-header.tsx` — page title + optional action.
- `stat-card.tsx` — KPI card (dashboard).
- `money-amount.tsx` — currency formatting with tabular figures.
- `data-table.tsx` — **generic table** used by accounts, holdings, transactions and cron runs.
  Define `Column<T>[]` and pass `data`, `getRowKey`, `isLoading`.
- `confirm-dialog.tsx` — reusable delete/confirm wrapper.
- `cron-section.tsx` — cron jobs + run history + "Run now".
- `category-badge.tsx` — `CategoryBadge` (per-category tinted pill) + `CategoryIcon` (matching
  tinted icon tile). Tints come from the design's categorical palette, keyed off the category name.
- `app-navigation.ts` / `app-logo.tsx` — shared route map and identity used by every shell variant.
- `app-bottom-nav.tsx` / `app-topbar.tsx` — the adaptive shell: centered floating desktop nav;
  compact phone topbar + fixed ink dock (4 tabs + a "More" sheet). Contextual period, search and
  lime **+ Add** controls stay route-scoped. No left sidebar.
- `charts/` — `net-worth-chart`, `allocation-chart`, `cashflow-chart` (shadcn Chart + Recharts).

## Design system ("modern ledger" — see root `DESIGN.md`)
- **Light theme only.** No dark mode, no `dark:` variants.
- **Fonts:** `font-display` (Space Grotesk) for headings/titles, `font-sans` (Hanken Grotesk) for
  body, `font-mono` (JetBrains Mono) for **every figure** — always pair with `tabular-nums`.
- **Palette via tokens:** `bg-primary` (lime) for CTAs/active nav, `text-positive`/`text-negative`
  for income/expense, `bg-sidebar` for ink "spotlight" cards, `var(--chart-1..6)` categorical ramp.
- **Cards:** 16px `border shadow-card ring-0` on opaque `bg-card`; titles `font-display font-semibold`.
- **Motion:** `.animate-fu` (fade-up entrance), `.animate-grow` (bar/progress fills).

## Conventions (shadcn rules)
- Layout via `className` only (`flex`, `gap-*`, `grid`). Prefer semantic tokens over raw hex; the
  only hand-tinted exception is `category-badge.tsx`, which maps the design's per-category palette.
- Use `gap-*`, not `space-x/y-*`. Use `size-*` when width == height.
- Semantic tokens (`bg-background`, `text-muted-foreground`) — no manual `dark:`.
- Status/labels via `Badge`/`CategoryBadge`; empty/loading via the `DataTable` states or `Skeleton`/`Empty`.
- Icons in buttons use `data-icon="inline-start"`; no sizing classes on icons.
- **Selects always show a human label, never the raw key.** Base UI's `<SelectValue />` renders the
  stored value unless the `<Select>` root gets an `items` prop. Always pass `items` — a
  `Record<value, label>` (shared maps like `DIRECTION_LABELS`/`TICKER_TYPE_LABELS` in `lib/format.ts`)
  or `{ value, label }[]` for dynamic lists.

## Data access
- Never fetch the backend directly here. Use the hooks in `src/hooks/*` (TanStack Query over
  the typed Hono RPC client in `src/lib/api-client.ts`). Mutations invalidate the relevant
  query keys (`src/lib/query-keys.ts`).
- Components needing state/effects/handlers must start with `"use client"`.
