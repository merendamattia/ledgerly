# Product

## Register

product

## Users

The internal team operates this dashboard daily:

- **Investment Managers** — manage the portfolio, track owned assets, monitor investment performance,
  update valuations, and review allocation changes.
- **Financial Analysts** — analyze expenses, cash flow, returns, asset distribution, and identify
  areas requiring attention.
- **Operations / Finance Team** — maintain financial records, categorize expenses, reconcile data,
  and monitor overall financial health.

Context of use: a financial operations dashboard open all day on a desktop monitor, returned to
dozens of times. Users are technical, fast, and already understand the financial domain. They scan
dense lists of investments, assets, transactions, and expenses, drill into one record, act, and move on.
Nobody is here to be entertained. They need accurate information with zero friction.

## Product Purpose

The Investment Dashboard is the operational control surface for managing financial assets and
investment operations. It consolidates portfolio tracking, asset ownership, investment performance,
expense monitoring, financial records, allocation analysis, and internal workflows into one
authenticated workspace.

The dashboard provides a single place to understand the current state of assets, identify changes
that require attention, monitor financial movements, and make informed decisions.

Success is measured in speed of analysis and clarity of financial state, not time-on-page. A good
screen lets a user understand the position of multiple investments in one glance, identify risks or
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

3. **Neutral by default, financial colors for meaning.**
   The interface uses simple, clean colors:
   - Green → income, positive performance, growth, gains, healthy status
   - Blue → stable assets, information, long-term investments
   - Orange → attention, pending actions, moderate risk
   - Red → expenses, losses, money out, critical issues

   Income is always green and expense is always red, applied consistently everywhere.

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

- Target **WCAG AA** contrast in both themes.
- Support light and dark themes with full component parity.
- The default visual direction should remain clean and bright, avoiding excessively dark surfaces.
- Visible focus on every interactive element (3px ring at 50% opacity on the ring color).
- Theme selection (light / dark / system) is user-controlled and persisted.
- Respect **reduced-motion**: animations are short and confirmatory.
- Financial states are never encoded by color alone — text labels and values always accompany colors.