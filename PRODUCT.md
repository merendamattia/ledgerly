# Product

Ledgerly is a **self-hosted, single-user personal finance console** — one authenticated owner
tracking their own net worth, investments and cash flow on their own server.

## User

One person: the owner running their own instance. Technical, fast, and already fluent in the
financial domain — they don't need hand-holding, they need their numbers accurate and instant.

Context of use: opened on a phone in the pocket and on a desktop tab that stays pinned, returned to
throughout the day. They scan dense lists of holdings, transactions and expenses, drill into one
record, act, and move on. Nobody is here to be entertained — the goal is zero-friction access to an
honest picture of their money.

There is no team, no roles, no multi-tenant workspace: a single admin account is seeded on first
start and owns everything.

## Product Purpose

Ledgerly is the operational control surface for one person's finances. It consolidates net-worth
tracking, asset ownership and valuation, investment performance, expense and cash-flow monitoring,
allocation analysis and a unified transaction ledger into one authenticated workspace — so the whole
financial picture lives in one place instead of scattered across bank apps, brokers and spreadsheets.

It provides a single place to understand the current state of assets, spot changes that need
attention, monitor movements, and make informed decisions.

Success is measured in speed of analysis and clarity of financial state, not time-on-page. A good
screen lets the owner grasp the position of every investment in one glance, see risks or
opportunities, and act without searching through multiple systems.

The interface is infrastructure, not a presentation layer.

## Brand Personality

Efficient, clear, precise. The reference lane is **Linear / Raycast**: quiet confidence,
high information density, keyboard-friendly, with micro-interactions that confirm actions without
distracting the user.

The UI is clean and neutral by default. Colors are used only to represent financial meaning:
performance, allocation, growth, risk, and expenses.

The product earns trust by being accurate, fast, and transparent.

Three words: **efficient, precise, balanced.**

## Anti-references

- **Generic identical card-grids.** No walls of same-sized cards with icon + heading + body
  text repeated endlessly. Financial data benefits from tables, lists, and dense structured views.

- **Marketing / landing-page aesthetics.** This is not a website. No giant heroes, oversized CTAs,
  promotional copy, or dashboard templates based only on large numbers.

- **Dark-mode-with-neon "finance AI" aesthetics.** No gradients, no glowing effects, no
  glassmorphism as decoration, no futuristic visual effects.

- **Heavy dark color palettes.** Avoid overly dark interfaces as the primary style. Prefer clean,
  readable surfaces with simple colors that support financial interpretation.

- **Decorative colors.** Colors must communicate meaning. They should never exist only for visual
  decoration.

## Design Principles

1. **Density is a feature.**
   Compact controls (`h-7`/`h-8`), small typography, and tight spacing allow users to monitor
   more financial information at once.

2. **Scan before read.**
   Optimize for financial overview: tables, consistent columns, aligned numbers, percentages,
   compact indicators, and predictable layouts. Controls always speak human: every select and
   dropdown shows a readable label (e.g. "Last 3 years", "Income"), never a raw stored key or tag.

3. **Warm-paper canvas, financial colors for meaning.**
   The interface sits on a warm-paper canvas with an ink bottom-nav bar; lime is the brand accent.
   Color otherwise carries meaning:
   - Lime → brand, primary actions, the active nav item
   - Green → income, positive performance, growth, gains, healthy status
   - Coral → expenses, losses, money out, critical issues
   - Blue / violet / amber → categorical series (allocation, category breakdowns)

   Income is always green and expense is always coral, applied consistently everywhere.

   Colors are never decorative and never used without supporting labels.

4. **Fast interaction and immediate feedback.**
   Actions should feel instant. Motion exists only to confirm state changes and should never slow
   down workflows.

5. **Flat, precise, no ornament.**
   Depth comes from subtle borders and spacing. Use hairline separators and minimal elevation.
   Data clarity is more important than visual effects.

6. **Financial clarity first.**
   Important information such as asset value, allocation, returns, expenses, and changes must be
   immediately visible without opening multiple views.

## Accessibility & Inclusion

- Target **WCAG AA** contrast on the warm-paper canvas.
- **Light theme only** — the warm-paper canvas is the single visual voice (no dark mode).
- Visible focus on every interactive element (ring on the green `ring` token).
- Respect **reduced-motion**: animations are short and confirmatory.
- Financial states are never encoded by color alone — text labels and values always accompany colors.
