---
name: Keplero Investment Dashboard
description: A high-density investment console — clear, data-forward, and color-aware for gains, losses and signals.
colors:
  background: "#F7FBFE"
  foreground: "#0F1724"
  card: "#FFFFFF"
  card-foreground: "#0F1724"
  popover: "#FFFFFF"
  popover-foreground: "#0F1724"
  primary: "#0B63CE"       # deep blue — brand / primary actions
  primary-foreground: "#FFFFFF"
  success: "#16A34A"       # gain / positive
  success-foreground: "#FFFFFF"
  danger: "#EF4444"        # loss / negative
  danger-foreground: "#FFFFFF"
  accent-gold: "#FBBF24"   # highlights, trophies
  muted: "#E6EEF9"
  muted-foreground: "#64748B"
  border: "#E6EEF9"
  input: "#FFFFFF"
  ring: "#93C5FD"
  chart-1: "#D6E9FF"
  chart-2: "#9CC7FF"
  chart-3: "#5DA8FF"
  chart-4: "#0B63CE"
  chart-5: "#083E8A"
  gradient-positive: "linear-gradient(90deg,#16A34A 0%,#34D399 100%)"
  gradient-negative: "linear-gradient(90deg,#EF4444 0%,#FB7185 100%)"
typography:
  heading:
    fontFamily: "Inter Variable, Inter, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 500
    lineHeight: 1.375
    letterSpacing: "-0.01em"
    fontFeature: "cv11, ss01, ss03"
  title:
    fontFamily: "Inter Variable, Inter, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "-0.01em"
  body:
    fontFamily: "Inter Variable, Inter, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
  small:
    fontFamily: "Inter Variable, Inter, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 400
    lineHeight: 1.4
  label-caps:
    fontFamily: "Inter Variable, Inter, system-ui, sans-serif"
    fontSize: "0.625rem"
    fontWeight: 600
    lineHeight: 1
    letterSpacing: "0.1em"
rounded:
  sm: "0.375rem"
  md: "0.5rem"
  lg: "0.625rem"
  xl: "0.875rem"
  2xl: "1.125rem"
  4xl: "1.625rem"
  pill: "9999px"
spacing:
  px2: "0.5rem"
  px2-5: "0.625rem"
  gap1-5: "0.375rem"
  gap2: "0.5rem"
  gap3: "0.75rem"
  gap4: "1rem"
  page: "1rem"
  page-md: "1.5rem"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-foreground}"
    rounded: "{rounded.lg}"
    height: "2rem"
    padding: "0 0.625rem"
  button-outline:
    backgroundColor: "{colors.background}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.lg}"
    height: "2rem"
    padding: "0 0.625rem"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.foreground}"
    rounded: "{rounded.lg}"
    height: "2rem"
    padding: "0 0.625rem"
  button-destructive:
    backgroundColor: "{colors.danger}"
    textColor: "{colors.danger-foreground}"
    rounded: "{rounded.lg}"
    height: "2rem"
    padding: "0 0.625rem"
  input:
    backgroundColor: "transparent"
    textColor: "{colors.foreground}"
    rounded: "{rounded.lg}"
    height: "2rem"
    padding: "0.25rem 0.625rem"
  select-trigger:
    backgroundColor: "transparent"
    textColor: "{colors.foreground}"
    rounded: "{rounded.lg}"
    height: "2rem"
    padding: "0 0.5rem 0 0.625rem"
  badge-pill:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-foreground}"
    rounded: "{rounded.pill}"
    height: "1.25rem"
    padding: "0.125rem 0.5rem"
  card:
    backgroundColor: "{colors.card}"
    textColor: "{colors.card-foreground}"
    rounded: "{rounded.xl}"
    padding: "1rem"
  table-row:
    backgroundColor: "{colors.background}"
    textColor: "{colors.foreground}"
    padding: "0.5rem"
  tab-trigger:
    backgroundColor: "{colors.background}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.md}"
    padding: "0.125rem 0.375rem"

---

# Design System: Keplero Investment Dashboard

## 1. Overview

**Creative North Star: "The Investor's Cockpit"**

This system is the decision surface for active investors and portfolio managers. Priorities are
clarity, immediate signal, and confident color: use color to encode performance, risk, and
opportunity while keeping the rest of the UI calm and readable. Controls remain compact and
dense so users can scan watchlists, holdings, and time-series quickly.

Built on Tailwind v4 token patterns and Inter Variable, the design balances high information
density with a bolder, investment-friendly palette: blues for brand/neutral actions, greens
for gains, reds for losses, and an accent gold for highlights and achievement states.

**Key Characteristics:**
- Signal-forward color system: color encodes gains, losses, alerts and opportunities.
- High density: compact controls, tabular numbers, and tight rhythm for lists and tables.
- Flat by default; floating panels keep subtle shadows for focus and legibility.
- Data-first components: charts, sparkline badges, and tabular summaries are primary.
- Motion is short and purposeful (ease-out-quart).

## 2. Colors

This system embraces color intentionally: not decorative, but informative. Palette choices aim
to help investors parse performance quickly — gains, losses, alerts, and secondary UI states are
distinct and accessible.

### Brand & Primary
- **Primary (Blue):** `#0B63CE` — brand actions, primary CTAs, and neutral chart series.
- **Accent Gold:** `#FBBF24` — highlights, awards, and positive callouts.

### Performance Signals
- **Gain / Income (Green):** `#16A34A` — income, positive returns, growth, money in, buy signals.
- **Loss / Expense (Red):** `#EF4444` — expenses, negative returns, drawdowns, money out, sell/alert states.

Income is always green and expense is always red, consistently across amounts, stat cards, and the
cash-flow / income-vs-expense charts.

### Support & Neutral
- **Muted / Surface:** `#E6EEF9` / `#FFFFFF` for cards and surfaces.
- **Foreground / Text:** `#0F1724` for high contrast reading on light backgrounds.
- **Ring / Focus:** `#93C5FD` for accessible focus outlines.

### Charts
- Use a blue ramp for neutral series (`chart-1` → `chart-5`) and overlay green/red ramps for
  performance-encoded series; use `gradient-positive` / `gradient-negative` for area fills when
  illustrating net change.

### Named Rules
**The Investment Color Rule.** Color is allowed and encouraged when it encodes financial meaning:
performance, risk tier, sector tags, or alerts. Decorative color is still discouraged — every hue
must carry information.

## 3. Typography

**Body & Display Font:** Inter Variable (fallback: Inter, system-ui). Maintain `tabular-nums`
for all numeric columns so financial figures align.

### Hierarchy
- **Heading / Page title:** medium 500, ~16px.
- **Title:** semibold 600, ~14px.
- **Body:** regular 400, ~14px.
- **Small / Micro:** `text-xs` / `label-caps` for dense UI and badge text.

Keep a single voice: weight and size, not a second typeface.

## 4. Elevation

Flat at rest; floating panels (charts tooltip, select content, command menus) may use a soft
shadow and a subtle ring to preserve legibility over colorful charts. Use shadow sparingly.

### Floating Vocabulary
- **Floating panel:** `shadow-sm + ring` for dropdowns and popovers.
- **Hover lift:** small `translate-y-0.5 + shadow-sm` on interactive rows/cards.

## 5. Components

All interactive components share an accessible focus treatment: `focus-visible:ring-3` using the
`ring` token, and `aria-invalid` surfaces use `danger` color tokens for clear feedback. Icons are
Lucide; sizes follow 4px steps.

### Buttons
- **Shape & Sizes:** `rounded-lg`, dense heights (`h-8` default). Icon variants match the same
  heights.
- **Primary:** `bg-primary text-primary-foreground`.
- **Success:** `bg-success text-success-foreground` (use for confirm actions related to trades,
  deposits, or realized gains).
- **Destructive:** `bg-danger/10 text-danger` with `hover:bg-danger/20` (tinted, not full red).
- **Ghost / Outline / Link:** as necessary, but ensure contrast and accessible hit targets.

### Inputs / Fields
- Match buttons with `h-8 rounded-lg border bg-input` and placeholder color `muted-foreground`.
- Focus uses `ring` token (`#93C5FD`) for clear keyboard navigation.

### Select / Dropdown triggers
- Floating panels use `bg-popover shadow-sm ring` to stay legible over charts. Items use
  subtle `hover` fills; performance tags can carry color chips (sector, rating, risk).

### Cards / Containers
- `rounded-xl`, `bg-card`, `border` hairline. Cards are used for holdings detail, watchlist
  item panels, position cards. Avoid card-grids for generic lists; prefer table/list patterns.

### Tables
- Use `tabular-nums` for all numeric columns. Header rows are compact (`h-10 px-2`) and rows
  support `hover` fills and selection states. Add inline sparklines / micro-charts per row where
  useful (e.g., 7d sparkline next to price).

### Status & Performance Badges
- **Shape:** pill with leading dot and label. Dots use `success` / `danger` / `accent-gold` for
  quick scanning (e.g., "Up 3.4%", "Down 1.2%", "Dividend"). Always pair color with text.

### Charts
- Default series: blue ramp. Overlay green/red fills for performance ranges. Use small, high
  contrast axis labels and a clear legend. When encoding risk or exposure, prefer bivariate
  color ramps (saturation for magnitude, hue for direction).

### Tabs, Navigation & App Shell
- Sidebar: `w-[240px]` expanded, compact collapse to `w-[56px]`. Active item uses a colored
  left indicator and `bg-primary/5` for focus.
- Header: sticky, subtle `backdrop-blur` and `border-b` to separate from content.

### The Select Label Rule
Every select trigger must show a **human-readable label**, never the stored key or tag (no raw
`EQUITY`, `36m`, `INCOME`, ids). This applies to all dropdowns everywhere, with no exceptions.

Base UI's `<Select.Value>` renders the raw value unless the `<Select>` root is given an `items`
map. Always pass `items` to the root, as a `Record<value, label>` (e.g. `DIRECTION_LABELS`,
`RANGE_LABELS`) or an array of `{ value, label }` for dynamic lists (categories, tickers). Shared
label maps live in `src/lib/format.ts`.

### Empty & Loading States
- **Empty:** `rounded-xl border bg-card py-12` with informative copy and suggested actions.
- **Loading:** skeleton shapes matching the replaced content; for charts use animated
  placeholders that indicate incoming data.

## 6. Do's and Don'ts

### Do:
- **Do** use color intentionally to encode financial meaning: gains, losses, risk, and alerts.
- **Do** keep dense, scannable layouts: compact controls, `tabular-nums`, and inline sparklines.
- **Do** use subtle shadows only for floating layers and tooltips.
- **Do** ensure all colors meet contrast requirements for accessibility.
- **Do** pair color with a textual label; never rely on color alone.

### Don't:
- **Don't** over-decorate: color must inform, not distract.
- **Don't** rely on multiple typefaces; keep a single voice.
- **Don't** apply heavy shadows to static cards; use hairline borders and rings.
- **Don't** introduce decorative gradients unless they convey data (e.g., performance area fills).
