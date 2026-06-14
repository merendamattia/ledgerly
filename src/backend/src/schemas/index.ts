import { z } from "zod";

// Input validation schemas (used by @hono/zod-validator at the API boundary).

export const tickerTypeSchema = z.enum(["EQUITY", "ETF", "CRYPTO"]);
export const categoryKindSchema = z.enum(["INCOME", "EXPENSE"]);
export const txDirectionSchema = z.enum(["INCOME", "EXPENSE"]);

// --- Assets / tickers -------------------------------------------------------
export const addAssetSchema = z.object({
  symbol: z.string().trim().min(1).max(32),
  type: tickerTypeSchema,
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
  cashAccountId: z.string().min(1).nullable().optional(),
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
  limit: z.coerce.number().int().positive().max(1000).optional(),
  offset: z.coerce.number().int().nonnegative().optional(),
});

// Dashboard query: how many trailing months of cash-flow to return.
export const dashboardQuerySchema = z.object({
  months: z.coerce.number().int().min(1).max(60).optional(),
});

// --- Settings ---------------------------------------------------------------
export const updateSettingsSchema = z.object({
  baseCurrency: z.string().trim().length(3).toUpperCase(),
});
