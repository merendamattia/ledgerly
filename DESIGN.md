---
name: Ledgerly — The Modern Ledger
description: A warm-paper finance console — accounting precision (tabular monospace figures, hairline rules) with expressive charts and a lively, signal-bearing palette.
colors:
  background: "#F4F2EA"      # warm paper canvas
  foreground: "#1A1B14"      # near-black ink text
  card: "#FFFFFF"
  card-foreground: "#15160F"
  popover: "#FFFFFF"
  popover-foreground: "#15160F"
  primary: "#C7F046"         # lime accent — primary CTAs, active nav, brand
  primary-foreground: "#15160F"
  positive: "#1C7A4D"        # growth green — income, gains, money in
  positive-foreground: "#FFFFFF"
  negative: "#DB5A3C"        # coral — expenses, losses, money out
  negative-foreground: "#FFFFFF"
  accent: "#EEF6DC"          # soft lime tint — subtle highlights
  accent-foreground: "#5B7D10"
  accent-gold: "#EBA23C"     # amber — attention / secondary highlight
  muted: "#F0EEE4"           # bar tracks, fills
  muted-foreground: "#807F70"
  border: "#E8E5D9"          # hairline rules
  input: "#E8E5D9"
  ring: "#1C7A4D"            # accessible green focus ring
  sidebar: "#15160F"         # ink sidebar
  sidebar-foreground: "#A7A99A"
  sidebar-primary: "#C7F046"
  sidebar-primary-foreground: "#15160F"
  chart-1: "#1C7A4D"         # categorical ramp (green / lime / blue / violet / amber / coral)
  chart-2: "#B9E84A"
  chart-3: "#3A72C4"
  chart-4: "#7B5BD6"
  chart-5: "#EBA23C"
  chart-6: "#DB5A3C"
typography:
  display:
    fontFamily: "Space Grotesk, sans-serif"   # headings, page titles, logo
    fontWeight: 600
    letterSpacing: "-0.02em"
  body:
    fontFamily: "Hanken Grotesk, system-ui, sans-serif"  # UI text, labels, body
    fontWeight: 400
  mono:
    fontFamily: "JetBrains Mono, monospace"    # ALL figures — tabular-nums
    fontWeight: 600
rounded:
  button: "0.75rem"
  card: "1.05rem"     # ~18px
  pill: "9999px"
elevation:
  card: "0 1px 2px rgba(20,20,15,.04), 0 12px 32px -20px rgba(20,20,15,.18)"   # .shadow-card
theme: light-only

---

# Design System: The Modern Ledger

## 1. Overview

**Creative North Star: "the modern ledger."** Ledgerly reinterprets the accounting ledger —
tabular monospace figures, hairline separators, accounting precision — but pairs it with
expressive, custom-built charts and a lively palette. Calm warm-paper surfaces keep dense
financial data readable; color is reserved for meaning (growth, spending, allocation).

**Light theme only.** There is no dark mode — the warm-paper canvas is the single voice.

**Key characteristics**
- Warm paper canvas (`#F4F2EA`) with a subtle radial wash; navigation is a **fixed bottom tab bar**
  (ink `#15160F`, no left sidebar) — the shell is mobile-first and identical on phone and desktop.
- **Lime** (`#C7F046`) is the brand accent: primary CTAs, the active nav item, the logo tile.
- Every figure is **JetBrains Mono, tabular-nums** so columns align like a ledger.
- White cards with a **hairline border** + soft elevated shadow; ~18px radius.
- Charts are protagonists: area charts, donuts, grouped bars, category progress — all on one
  coherent **categorical ramp**, with short fade-up / grow entrance animations.

## 2. Color

Color carries meaning, never decoration.

- **Lime `#C7F046`** — brand / primary actions / active navigation (ink text on lime).
- **Growth green `#1C7A4D`** — income, gains, positive deltas, money in.
- **Coral `#DB5A3C`** — expenses, losses, negative deltas, money out.
- **Ink `#15160F`** — the bottom-nav bar and "spotlight" dark cards (e.g. savings rate, net flow),
  where lime numerals pop.
- **Categorical ramp** (`chart-1…6`: green, lime, blue, violet, amber, coral) for allocation
  donuts, category breakdowns and any multi-series chart.

Income is always green and expense always coral, consistently across amounts, KPI cards and charts.

## 3. Typography

Three families, each with one job:
- **Space Grotesk** (`--font-display`) — headings, page titles, the logo. Tight tracking.
- **Hanken Grotesk** (`--font-sans`) — UI text, labels, body copy.
- **JetBrains Mono** (`--font-mono`) — every monetary figure and metric, `tabular-nums`.

Fonts load via `next/font/google` in `src/app/layout.tsx`. Headings (`h1–h3`) get the display
family automatically in `globals.css`.

## 4. Layout & shell

Mobile-first: one shell for phone and desktop — a sticky topbar over a **fixed bottom tab bar**
(there is no left sidebar).

- **Topbar:** sticky, `bg-background/80` + `backdrop-blur`, hairline bottom border. App logo tile,
  per-route title (display font) + subtitle, contextual controls (the cash-flow period picker,
  Transactions search) and the lime **+ Add** button — shown only on sections that can create a
  movement (Transactions, Cash Flow, Investments), with a section-scoped label.
- **Bottom nav:** fixed at every screen size, ink-on-paper. Four primary tabs — **Overview,
  Invest, Cash flow, Activity** — plus a **More** tab that opens a bottom sheet with the secondary
  routes (Matrices, Imports, Settings, Database, Dev) and Logout. The active tab gets a lime pill.
- **Content:** a responsive 12-column grid (`grid-cols-12`, `gap-4 md:gap-5`). Cards are full- or
  half-width on mobile and take 3/4/5/7/8 columns from `lg` up.

## 5. Components

- **Cards** — `bg-card`, hairline `border`, `.shadow-card`, ~18px radius. Titles use the display
  font at 16px/600. "Spotlight" variants use the ink `bg-sidebar` with lime figures.
- **Buttons** — primary = lime fill + ink text, `rounded-xl`, dense height. Outline/ghost as needed.
- **Filter chips** (Transactions) — active = ink fill + paper text; inactive = white + hairline border.
- **Badges** — category pills are **tinted per category** (soft bg + saturated text) from the
  palette in `category-badge.tsx`; leading icon tiles reuse the same tints.
- **Tables / ledger rows** — CSS-grid rows, hairline separators, mono right-aligned amounts
  (green/coral by sign), tinted category badge, mono date column.
- **Charts** — Recharts via the shadcn `Chart` wrappers; series colors come from the CSS tokens
  (`var(--chart-n)`, `var(--positive)`, `var(--negative)`). Money axes use compact formatting.
- **Progress bars** — `bg-muted` track + colored fill with the `.animate-grow` entrance.

### The Select Label Rule
Every select trigger must show a **human-readable label**, never the stored key (no raw `EXPENSE`,
`12m`, ids). Base UI's `<SelectValue>` renders the raw value unless the `<Select>` root gets an
`items` map — always pass `items` (a `Record<value,label>` such as `DIRECTION_LABELS`, or a
`{ value, label }[]` for dynamic lists). Shared maps live in `src/lib/format.ts`.

## 6. Motion

Short and purposeful: `.animate-fu` (fade-up) for section/card entrance, `.animate-grow` for bars
and progress fills. Defined in `globals.css`. Nothing loops; motion confirms, never distracts.

## 7. Do's and Don'ts

**Do**
- Use the tokens (`bg-card`, `text-positive`, `var(--chart-3)`) — never hardcode palette hex in pages.
- Keep all figures in `font-mono` + `tabular-nums`.
- Reserve lime for brand/primary and ink dark cards for "spotlight" metrics.
- Pair every color with a textual label.

**Don't**
- Add a dark mode or `dark:` variants — the app is light-only.
- Decorate with color that carries no meaning.
- Use heavy shadows on static cards — one soft `.shadow-card` + a hairline border is the rule.
- Mix in a fourth typeface; the three families above are the whole system.
