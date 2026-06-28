import { z } from "zod";

// Input validation schemas (used by @hono/zod-validator at the API boundary).

export const tickerTypeSchema = z.enum(["EQUITY", "ETF", "CRYPTO", "BOND", "COMMODITY"]);
export const categoryKindSchema = z.enum(["INCOME", "EXPENSE"]);
export const txDirectionSchema = z.enum(["INCOME", "EXPENSE"]);
export const investmentSideSchema = z.enum(["BUY", "SELL"]);
export const cashCategorySchema = z.enum(["LIQUIDITY", "CREDIT", "OTHER_ASSET"]);
export const investmentImportFieldSchema = z.enum(["ticker", "price", "quantity", "total", "date", "broker"]);

// --- Assets / tickers -------------------------------------------------------
export const addAssetSchema = z.object({
  symbol: z.string().trim().min(1).max(32),
  type: tickerTypeSchema,
  isin: z.string().trim().length(12).toUpperCase().optional(),
});

// Manually-tracked asset (a bond/commodity Yahoo can't price). The user supplies
// the metadata and an initial price; no provider backfill runs for it.
export const addManualAssetSchema = z.object({
  symbol: z.string().trim().min(1).max(32),
  name: z.string().trim().min(1).max(120),
  type: tickerTypeSchema,
  currency: z.string().trim().length(3).toUpperCase(),
  isin: z.string().trim().length(12).toUpperCase().optional(),
  price: z.number().nonnegative(),
});

// Set/update the current price of a manually-tracked asset.
export const setManualPriceSchema = z.object({
  price: z.number().nonnegative(),
  date: z.coerce.date().optional(),
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

export const investmentImportColumnMapSchema = z.object({
  ticker: z.number().int().nonnegative().nullable().default(null),
  price: z.number().int().nonnegative().nullable().default(null),
  quantity: z.number().int().nonnegative().nullable().default(null),
  total: z.number().int().nonnegative().nullable().default(null),
  date: z.number().int().nonnegative().nullable().default(null),
  broker: z.number().int().nonnegative().nullable().default(null),
  defaults: z
    .object({
      ticker: z.string().trim().min(1).optional(),
      date: z.string().trim().min(1).optional(),
      broker: z.string().trim().min(1).optional(),
    })
    .default({}),
  skipHeader: z.boolean().default(true),
});

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

// --- Bulk snapshot import (date,account1,account2,… CSV/TSV) -----------------
// Each non-date column maps to a target: skip it, point it at an existing cash
// account / debt, or create a new one. `index` is the column position in the file.
export const snapshotImportColumnSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("skip"), index: z.number().int().nonnegative() }),
  z.object({
    action: z.literal("existing"),
    index: z.number().int().nonnegative(),
    kind: z.enum(["CASH", "DEBT"]),
    id: z.string().min(1),
  }),
  z.object({
    action: z.literal("create"),
    index: z.number().int().nonnegative(),
    name: z.string().trim().min(1).max(80),
    // A new cash account in one of the three categories, or a new debt.
    kind: z.enum(["LIQUIDITY", "CREDIT", "OTHER_ASSET", "DEBT"]),
    currency: z.string().trim().length(3).toUpperCase(),
  }),
]);

export const snapshotImportCommitSchema = z.object({
  dateColumn: z.number().int().nonnegative(),
  columns: z.array(snapshotImportColumnSchema),
  rows: z.array(z.array(z.string())).min(1).max(10000),
});

// --- Cash snapshots (dated balances) ----------------------------------------
export const createCashSnapshotSchema = z.object({
  date: z.coerce.date(),
  entries: z
    .array(
      z.object({
        accountId: z.string().min(1),
        balance: z.number(),
        note: z.string().trim().max(280).nullable().optional(),
      }),
    )
    .min(1),
});

// --- Debt snapshots (dated amounts) -----------------------------------------
export const createDebtSnapshotSchema = z.object({
  date: z.coerce.date(),
  entries: z
    .array(
      z.object({
        debtId: z.string().min(1),
        amount: z.number(),
        note: z.string().trim().max(280).nullable().optional(),
      }),
    )
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
  category: cashCategorySchema.default("LIQUIDITY"),
  currency: z.string().trim().length(3).toUpperCase(),
  balance: z.number().default(0),
  note: z.string().trim().max(280).nullable().optional(),
});

export const updateAccountSchema = createAccountSchema.partial();

// --- Categories -------------------------------------------------------------
export const createCategorySchema = z.object({
  name: z.string().trim().min(1).max(60),
  kind: categoryKindSchema,
  emoji: z.string().trim().min(1).max(16).optional(),
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

// --- Recurring expenses -----------------------------------------------------
export const recurIntervalSchema = z.enum(["DAY", "WEEK", "MONTH"]);
export const recurEndModeSchema = z.enum(["NEVER", "AFTER_OCCURRENCES", "ON_DATE"]);

const recurringBaseSchema = z.object({
  categoryId: z.string().min(1).nullable().optional(),
  amount: z.number().positive(),
  direction: txDirectionSchema,
  note: z.string().trim().max(280).nullable().optional(),
  intervalUnit: recurIntervalSchema,
  intervalCount: z.coerce.number().int().min(1).max(365),
  startDate: z.coerce.date(),
  endMode: recurEndModeSchema.default("NEVER"),
  maxOccurrences: z.coerce.number().int().min(1).max(1000).nullable().optional(),
  endDate: z.coerce.date().nullable().optional(),
  enabled: z.boolean().optional(),
});

// AFTER_OCCURRENCES needs a count; ON_DATE needs an end date. Only enforced on
// create — partial updates may omit endMode and tweak a single field.
export const createRecurringSchema = recurringBaseSchema
  .refine((v) => v.endMode !== "AFTER_OCCURRENCES" || v.maxOccurrences != null, {
    message: "maxOccurrences is required when endMode is AFTER_OCCURRENCES",
    path: ["maxOccurrences"],
  })
  .refine((v) => v.endMode !== "ON_DATE" || v.endDate != null, {
    message: "endDate is required when endMode is ON_DATE",
    path: ["endDate"],
  });

export const updateRecurringSchema = recurringBaseSchema.partial();

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
