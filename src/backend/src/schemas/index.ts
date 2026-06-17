import { z } from "zod";

// Input validation schemas (used by @hono/zod-validator at the API boundary).

export const tickerTypeSchema = z.enum(["EQUITY", "ETF", "CRYPTO"]);
export const categoryKindSchema = z.enum(["INCOME", "EXPENSE"]);
export const txDirectionSchema = z.enum(["INCOME", "EXPENSE"]);
export const investmentSideSchema = z.enum(["BUY", "SELL"]);

// --- Assets / tickers -------------------------------------------------------
export const addAssetSchema = z.object({
  symbol: z.string().trim().min(1).max(32),
  type: tickerTypeSchema,
});

export const tickerSearchSchema = z.object({
  q: z.string().trim().min(1).max(64),
  type: tickerTypeSchema.optional(),
});

// --- Investment transactions (buy/sell ledger) ------------------------------
export const createInvestmentTxSchema = z.object({
  tickerId: z.string().min(1),
  cashAccountId: z.string().min(1),
  date: z.coerce.date(),
  side: investmentSideSchema,
  quantity: z.number().positive(),
  price: z.number().nonnegative(),
  fee: z.number().nonnegative().optional(),
  note: z.string().trim().max(280).nullable().optional(),
});

// Edit keeps the same ticker (the position drives the ticker); everything else
// can change. recomputeHolding runs on the existing ticker after the update.
export const updateInvestmentTxSchema = createInvestmentTxSchema.omit({ tickerId: true });

export const investmentTxFiltersSchema = z.object({
  tickerId: z.string().min(1).optional(),
  side: investmentSideSchema.optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  limit: z.coerce.number().int().positive().max(5000).optional(),
  offset: z.coerce.number().int().nonnegative().optional(),
});

// One row of an investment CSV import. The frontend has already mapped the raw
// ticker/broker strings to real ids; rows duplicating an existing movement are
// skipped server-side. Same field shape as createInvestmentTxSchema.
export const importInvestmentTxRowSchema = createInvestmentTxSchema;

export const importInvestmentTxCommitSchema = z.object({
  rows: z.array(importInvestmentTxRowSchema).min(1).max(5000),
});

// --- Debts (liabilities) ----------------------------------------------------
export const createDebtSchema = z.object({
  name: z.string().trim().min(1).max(80),
  type: z.string().trim().min(1).max(40).default("LOAN"),
  currency: z.string().trim().length(3).toUpperCase(),
  amount: z.number().nonnegative(),
  note: z.string().trim().max(280).nullable().optional(),
});

export const updateDebtSchema = createDebtSchema.partial();

// --- Cash snapshots (dated balances) ----------------------------------------
export const createCashSnapshotSchema = z.object({
  date: z.coerce.date(),
  entries: z
    .array(z.object({ accountId: z.string().min(1), balance: z.number() }))
    .min(1),
});

// --- Debt snapshots (dated amounts) -----------------------------------------
export const createDebtSnapshotSchema = z.object({
  date: z.coerce.date(),
  entries: z
    .array(z.object({ debtId: z.string().min(1), amount: z.number() }))
    .min(1),
});

// --- Holdings ---------------------------------------------------------------
export const createHoldingSchema = z.object({
  tickerId: z.string().min(1),
  quantity: z.number().positive(),
  avgCost: z.number().nonnegative(),
  cashAccountId: z.string().min(1).nullable().optional(),
});

export const updateHoldingSchema = z.object({
  quantity: z.number().positive().optional(),
  avgCost: z.number().nonnegative().optional(),
  cashAccountId: z.string().min(1).nullable().optional(),
});

// --- Cash accounts ----------------------------------------------------------
export const createAccountSchema = z.object({
  name: z.string().trim().min(1).max(80),
  type: z.string().trim().min(1).max(40).default("BANK"),
  currency: z.string().trim().length(3).toUpperCase(),
  balance: z.number().default(0),
});

export const updateAccountSchema = createAccountSchema.partial();

// --- Categories -------------------------------------------------------------
export const createCategorySchema = z.object({
  name: z.string().trim().min(1).max(60),
  kind: categoryKindSchema,
});

export const updateCategorySchema = createCategorySchema.partial();

// --- Transactions (expenses/income) -----------------------------------------
export const createTransactionSchema = z.object({
  categoryId: z.string().min(1).nullable().optional(),
  date: z.coerce.date(),
  amount: z.number().positive(),
  direction: txDirectionSchema,
  note: z.string().trim().max(280).nullable().optional(),
});

export const updateTransactionSchema = createTransactionSchema.partial();

// One row from a Budjet CSV import. `category` is the verbatim (lowercase) name;
// the import service resolves it to a Category id (creating it if missing).
export const importRowSchema = z.object({
  direction: txDirectionSchema,
  category: z.string().trim().min(1).max(60).nullable().optional(),
  date: z.coerce.date(),
  amount: z.number().positive(),
  note: z.string().trim().max(280).nullable().optional(),
});

export const importCommitSchema = z.object({
  rows: z.array(importRowSchema).min(1),
});

export const transactionFiltersSchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  categoryId: z.string().min(1).optional(),
  direction: txDirectionSchema.optional(),
  limit: z.coerce.number().int().positive().max(5000).optional(),
  offset: z.coerce.number().int().nonnegative().optional(),
});

// Dashboard query: how many trailing months of cash-flow to return.
export const dashboardQuerySchema = z.object({
  months: z.coerce.number().int().min(1).max(60).optional(),
});

// Per-position returns query: ISO day (yyyy-mm-dd) the window starts from.
export const holdingReturnsQuerySchema = z.object({
  from: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});

// --- Settings ---------------------------------------------------------------
export const updateSettingsSchema = z.object({
  baseCurrency: z.string().trim().length(3).toUpperCase(),
});
