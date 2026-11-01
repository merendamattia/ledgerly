# Financial analysis and forecasts

[Documentation index](README.md) · [Background operations](deployment.md#scheduled-operations)

## Using Analysis

Open **More → Analysis** to compare observed net worth, income, expenses and investments with
Monte Carlo percentile ranges. The 1, 2, 5, 10, 15 and 20-year choices show different portions of
the same result. **New simulation** requests a replacement for your own account. The previous
valid snapshot stays visible while the new one runs.

## Method and stored results

The weekly producer queues one 10,000-path, 240-month forecast per user. Forecasts bootstrap
the latest 12 monthly cash-flow observations, incorporate known recurring movements, and compound
flow-adjusted portfolio returns on existing invested capital plus future contributions. Sparse
history uses all available months and is marked as reduced confidence.

Analysis never runs Monte Carlo work on page load or when its 1, 2, 5, 10, 15 or 20-year selector
changes. PostgreSQL stores compact mean/P10/P25/P50/P75/P90 aggregates for all 240 future months;
the browser slices that result locally. A manual **New simulation** action queues only the signed-in
user and keeps the last valid snapshot visible while the replacement runs. Per-user guarded state
prevents overlapping simulations.

The model treats investment-category transactions as contributions rather than consumption. It
removes net contributions from month-to-month portfolio value changes before sampling market
returns, then compounds sampled returns on the provider-backed portfolio sleeve with sufficient
ledger and price coverage and its share of subsequent contributions. Manual, unpriced, or
insufficiently supported investment value stays flat. Credits, other
manually managed assets and debts also stay flat unless their effect appears in cash-flow history.
Forecasts are estimates, not guarantees or financial advice; long-horizon ranges are illustrative
because uncertainty compounds.

Each completed forecast also queues an optional OpenAI interpretation. Only aggregate metrics and
selected horizon summaries are sent with `store: false`; raw transactions are not sent. The output
is schema-validated, localized to the user's Ledgerly language and bound to the exact snapshot.
OpenAI failure does not invalidate the deterministic forecast.

## Data quality and limitations

The forecast depends on recorded cash flow, recurring rules, valuations, FX and price coverage;
it cannot repair missing or incorrect records. Review data-quality and confidence information
alongside the percentile bands. Contributions are not market returns, and unsupported assets
are not assigned an invented growth rate. Changes in future income, spending, markets, debt
terms or asset values can make the historical assumptions unsuitable.

The deterministic simulation runs in a BullMQ worker and reads persisted financial/market data.
The optional interpretation runs separately; OpenAI is not the calculation engine. See
[Architecture](architecture.md) for ownership and [Deployment](deployment.md) for schedules,
Redis and worker configuration.
