---
name: Ledgerly — The Floating Ledger
description: A light, adaptive finance console — accounting precision inside calm floating navigation and focused data surfaces.
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
  negative: "#DB5A3C"        # coral — chart/fill for expenses, losses, money out
  negative-ink: "#B94731"    # AA text tone derived from the same coral
  negative-foreground: "#FFFFFF"
  destructive: "#DB5A3C"
  destructive-ink: "#B94731"
  accent: "#EEF6DC"          # soft lime tint — subtle highlights
  accent-foreground: "#55750F"
  accent-gold: "#EBA23C"     # amber — attention / secondary highlight
  muted: "#F0EEE4"           # bar tracks, fills
  muted-foreground: "#69695D" # adjusted within the neutral family for WCAG AA
  border: "#DFDCCF"          # hairline rules
  input: "#D8D5C8"
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
  card: "1rem"
  pill: "9999px"
elevation:
  card: "0 1px 2px rgba(20,20,15,.06), 0 6px 8px -8px rgba(20,20,15,.24)"   # .shadow-card
theme: light-only

---

# Design System: The Floating Ledger

## 1. Overview

**Creative North Star: "the floating ledger."** Ledgerly keeps the accounting ledger's tabular
figures, hairline separators and precision, but places them inside an adaptive shell inspired by
lightweight financial workspaces: ambient palette-colored light, one floating navigation surface,
and quiet opaque data panels. Color remains reserved for meaning (growth, spending, allocation).

**Light theme only.** There is no dark mode — the warm-paper canvas is the single voice.

**Key characteristics**
- Warm paper canvas (`#F4F2EA`) with lime and green ambient light. The shell changes by device:
  a floating top navigation on desktop and a thumb-reachable ink dock on phone.
- **Lime** (`#C7F046`) is the brand accent: primary CTAs, the active nav item, the logo tile.
- Every figure is **JetBrains Mono, tabular-nums** so columns align like a ledger.
- White cards with a **hairline border** + compact shadow; 16px radius.
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
Small coral/error text on light surfaces uses `negative-ink` / `destructive-ink`; the original
coral stays unchanged for charts, backgrounds and AA text on ink surfaces.

## 3. Typography

Three families, each with one job:
- **Space Grotesk** (`--font-display`) — headings, page titles, the logo. Tight tracking.
- **Hanken Grotesk** (`--font-sans`) — UI text, labels, body copy.
- **JetBrains Mono** (`--font-mono`) — every monetary figure and metric, `tabular-nums`.

Fonts load from the installed local font packages through `next/font/local` in `src/app/layout.tsx`. Headings (`h1–h3`) get the display
family automatically in `globals.css`.

## 4. Layout & shell

Mobile-first, with no left sidebar.

- **Desktop (`lg+`):** a sticky, floating white topbar inside the same `max-w-[100rem]` frame as
  page content. Primary sections are visible in the center; secondary routes and sign-out live in
  **More**. Search, period, view switches and creation actions remain contextual on the right.
- **Phone/tablet (`<lg`):** the compact floating topbar shows route identity and contextual tools;
  the fixed ink dock keeps four primary tabs plus **More** within thumb reach. Secondary routes and
  sign-out open in a bottom sheet. Safe-area padding is mandatory.
- **Content:** responsive 12-column analytical grids where useful; admin screens use a readable
  vertical flow. The page frame uses 12px phone gutters and grows to 32px on wide screens.
- **320px rule:** controls may wrap into a second header row, but the page must never introduce
  accidental horizontal scrolling. Wide financial tables own their explicit horizontal scroller.

## 5. Components

- **Cards** — opaque `bg-card`, hairline `border`, `.shadow-card`, 16px radius. Titles use the display
  font at 16px/600. "Spotlight" variants use the ink `bg-sidebar` with lime figures.
- **Buttons** — primary = lime fill + ink text, compact inset edge, 40px default height. Outline and
  ghost variants keep the same geometry; icon controls keep an accessible 40px target by default.
- **Inputs/selects** — white, 40px tall, visible hover border and green focus ring. Native date
  inputs stay native. All phone text inputs remain at least 16px to prevent iOS zoom.
- **Dialogs** — bottom sheets on phone, centered dialogs from `sm` upward. Every dialog and sheet
  retains a programmatic title and safe-area padding.
- **Filter chips** (Transactions) — active = ink fill + paper text; inactive = white + hairline border.
- **Badges** — category pills are **tinted per category** (soft bg + saturated text) from the
  palette in `category-badge.tsx`; leading icon tiles reuse the same tints.
- **Tables / ledger rows** — CSS-grid rows, hairline separators, mono right-aligned amounts
  (green/coral by sign), tinted category badge, mono date column.
- **Charts** — use the official EvilCharts ECharts components for pie, dotted/stacked area, bar and
  Sankey views. Install or adapt chart components only from <https://evilcharts.com/docs>, retain
  only the registry files imported by the app, and source series colors from the CSS tokens
  (`var(--chart-n)`, `var(--positive)`, `var(--negative)`). Money axes use compact formatting.
- **Progress bars** — `bg-muted` track + colored fill with the `.animate-grow` entrance.

### The Select Label Rule
Every select trigger must show a **human-readable label**, never the stored key (no raw `EXPENSE`,
`12m`, ids). Base UI's `<SelectValue>` renders the raw value unless the `<Select>` root gets an
`items` map — always pass `items` (a `Record<value,label>` such as `DIRECTION_LABELS`, or a
`{ value, label }[]` for dynamic lists). Shared maps live in `src/lib/format.ts`.

## 6. Motion

Short and purposeful: `.animate-fu` is a 240ms fade/8px rise; `.animate-grow` is a 350ms bar reveal.
Navigation and controls use 150–200ms state transitions. Nothing loops, and the global
`prefers-reduced-motion` rule collapses all animation and transition durations.

## 7. Do's and Don'ts

**Do**
- Use the tokens (`bg-card`, `text-positive`, `var(--chart-3)`) — never hardcode palette hex in pages.
- Keep all figures in `font-mono` + `tabular-nums`.
- Reserve lime for brand/primary and ink dark cards for "spotlight" metrics.
- Pair every color with a textual label.

**Don't**
- Add a dark mode or `dark:` variants — the app is light-only.
- Decorate with color that carries no meaning.
- Use wide ghost-card shadows. Static surfaces use one compact `.shadow-card`; backdrop blur belongs
  only to the floating navigation and authentication frame.
- Mix in a fourth typeface; the three families above are the whole system.
