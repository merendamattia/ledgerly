# Getting started

[Documentation index](README.md)

## Choose an installation

Ledgerly runs on your own infrastructure and is used through a desktop or mobile browser.
An instance needs the application, its background worker, PostgreSQL and Redis, plus persistent
storage and backups. There is no public sign-up flow.

- To operate an instance, follow [Deployment](deployment.md). You need a server or Coolify
  installation, a container build/runtime, PostgreSQL and Redis resources, and public HTTPS URLs.
- To run from source on your machine, follow [Development](development.md#local-setup).
  This uses Bun and Docker Compose for the local database and cache.
- To join an existing instance, ask its administrator for your login and its frontend URL.

## Sign in and set your preferences

The initial administrator is created on backend startup using the configured `ADMIN_EMAIL`
and `ADMIN_PASSWORD`. Administrators create member logins in Settings with an email address and
temporary password. Members must choose a permanent password before using the app and select
their application language during first-use onboarding.

Each login has independent financial data, categories and settings. New members receive copies
of the administrator's base currency and categories; they choose their own language.
Financial accounts under **Accounts** are separate from these user logins.

## Build your financial overview

1. In **Settings**, check your base currency, language and income/expense categories.
2. Open **More → Accounts** to add cash accounts and debts with their currencies and balances.
3. In **Wealth**, add assets or investments. Provider-backed tickers can bring daily closing-price
   history; manually valued assets require your own updates. Record purchases and sales where needed.
4. In **Activity**, add income and expenses, select categories and add notes or tags. Use recurring
   movements for regular income or bills; read the [rule-edit guide](recurring-transactions.md)
   before changing a schedule with booked history.
5. Review **Overview** and **Cash Flow**. Use **Matrices** for comparisons across periods and
   [Analysis](analysis.md) for scenarios once you have useful history.

Use [Imports](integrations.md#imports) for supported existing records. Preview and reconcile them
before committing. Wallet automation and notifications are optional, configured from
**Settings → Advanced**; see [Integrations](integrations.md).

Figures depend on the balances, movements, prices and exchange rates available to Ledgerly.
Review missing or stale data before relying on a total. Forecast ranges are illustrative,
not financial advice.
