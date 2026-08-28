# Ledgerly UI/UX refactor

Branch: `refactor/ui-ux-financial` (from `origin/develop` at `6166fed`)

## Guardrails

- [x] Read the supplied visual reference.
- [x] Start from the latest `origin/develop` on a dedicated branch.
- [x] Keep all implementation changes inside `src/frontend` (apart from this checklist and design/project documentation).
- [x] Preserve every existing backend contract, query, mutation, and user flow.
- [x] Keep the existing Ledgerly palette and use semantic design tokens rather than page-level colors.
- [x] Reuse existing components first; add a shared component before using a new repeated pattern.
- [x] Build mobile-first for daily smartphone use, then enhance for tablet and desktop; keep it keyboard accessible and reduced-motion safe.

## 1. Inventory and direction

- [x] Inventory every frontend route and its loading, empty, error, and populated states.
- [x] Map shared shell, navigation, dialogs, forms, tables, charts, and repeated page patterns.
- [x] Capture a desktop and mobile visual baseline of each reachable route.
- [x] Translate the reference style into Ledgerly's product context without copying its marketing hero.
- [x] Record the final layout, typography, surface, motion, and component rules in `DESIGN.md`.

## 2. Shared foundations

- [x] Refine global tokens, typography, spacing, radii, borders, shadows, focus, and motion in `globals.css`.
- [x] Refactor shared app shell: top bar, primary navigation, secondary navigation, and content container.
- [x] Refactor shared primitives and variants before page usage (buttons, inputs, selects, dialogs, sheets, badges, tables, empty/loading states).
- [x] Add only the smallest missing reusable page-level components needed by multiple routes.

## 3. Routes

- [x] Login (`/login`).
- [x] Overview (`/`).
- [x] Investments (`/investments`).
- [x] Cash flow (`/cashflow`).
- [x] Transactions / activity (`/transactions`).
- [x] Accounts (`/accounts`).
- [x] Matrices (`/matrix`).
- [x] Imports (`/imports`).
- [x] Settings (`/settings`).
- [x] Database (`/database`).
- [x] Developer tools (`/dev`).

## 4. UX and quality gates

- [x] Verify every existing create, edit, delete, import, filter, search, period, navigation, privacy, and logout flow.
- [x] Verify readable labels for all selects and non-color cues for financial state.
- [x] Verify keyboard focus, dialog/sheet titles, form labels, validation, touch targets, and contrast.
- [x] Verify 320 px and 390 px smartphones plus desktop, including long values and no accidental document-level horizontal scroll.
- [x] Run frontend tests; existing responsive layout checks cover the shared behavior changed here (21 passed).
- [x] Run `bun run lint` in `src/frontend`.
- [x] Run `bun run build` in `src/frontend`.
- [x] Run repository checks: all applicable pre-commit hooks passed; the baseline skill files blocked only the all-files EOF fixer under the read-only sandbox, so that hook was run on this change set; backend typecheck and 54 isolated tests passed.
- [x] Inspect all 11 routes in-browser at 320 px, 390 px, and 1440 px; no document overflow or runtime errors.
- [x] Confirm `git diff` contains no backend, hook, or API-client changes.

## 5. Preview follow-up

- [x] Keep the desktop primary navigation geometrically fixed when contextual controls change.
- [x] Keep the Ledgerly identity and route label visible in narrow mobile headers.
- [x] Move wide contextual controls such as the cash-flow period to a dedicated second row on mobile while keeping the add action available.
- [x] Inventory every month/year selector and replace bounded hardcoded month lists with one reusable searchable picker.
- [x] Migrate the requested charts to the official EvilCharts ECharts components: `EChartsPieChart` for allocation pies, stacked dotted `EChartsAreaChart` for Net Worth/investments, `EChartsBarChart` for Cashflow trend, and `EChartsSankeyChart` for the cash-flow pipeline.
- [x] Wire each ECharts `isLoading` prop to the real query loading state and remove unused EvilCharts registry files/dependencies.
- [x] Restyle the remaining charts and diagrams with the floating-ledger surface, grid, tooltip, stroke, and hierarchy rules where their APIs allow it.
- [x] Restyle all application dialogs, sheets, confirmations, import previews, and action popups with one coherent overlay system.
- [x] Rebuild the standalone Accounts registry with the new responsive card layout.
- [x] Match the Activity type filter to the Wealth segmented switch, including active, hover, and white-border treatment.
- [x] Keep chart tooltips opaque and truncate long Wealth allocation/position labels without losing the full accessible name.
- [x] Match the rebalancing allocation donut to the approved Overview/Wealth donut style.
- [x] Move transient save/update notifications to bottom-center without covering the mobile navigation.
- [x] Re-run 320 px, 390 px, tablet, and desktop browser checks plus interaction tests.
- [x] Re-run frontend tests, lint, build, UI detector, repository checks, and confirm no backend/API source changes.

## 6. Monthly trend histogram follow-up

- [x] Activate EvilCharts `stackType="stacked"` for the Expense and Investments group while keeping Income separate.
- [x] Move the Monthly trend legend farther below the X-axis labels.
- [x] Verify the result in-browser on desktop and smartphone.
- [x] Re-run frontend checks and commit the follow-up.
