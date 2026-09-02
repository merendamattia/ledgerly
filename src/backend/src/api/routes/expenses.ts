import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import type { Prisma } from "@prisma/client";
import { requireAuth } from "../middlewares/auth.ts";
import { transactionRepository } from "../../repositories/transaction.ts";
import { categoryRepository } from "../../repositories/category.ts";
import {
  createTransactionSchema,
  transactionTagsQuerySchema,
  transactionFiltersSchema,
  transactionSummaryQuerySchema,
  updateTransactionSchema,
} from "../../schemas/index.ts";
import { listTransactionTags } from "../../services/transactionTags.ts";
import { serializeTransaction } from "../../utils/serialize.ts";
import { createTransaction } from "../../services/transactions.ts";
import { NotFoundError } from "../../core/errors.ts";
import type { AppEnv } from "../types.ts";

type TxInput = Partial<{
  categoryId: string | null;
  date: Date;
  amount: number;
  direction: "INCOME" | "EXPENSE";
  note: string | null;
}>;

/**
 * Builds Prisma update data from a validated transaction payload.
 */
function toTxData(input: TxInput): Prisma.TransactionUpdateInput {
  const data: Prisma.TransactionUpdateInput = {};
  if (input.date !== undefined) data.date = input.date;
  if (input.amount !== undefined) data.amount = input.amount;
  if (input.direction !== undefined) data.direction = input.direction;
  if (input.note !== undefined) data.note = input.note;
  if (input.categoryId !== undefined) {
    data.category = input.categoryId ? { connect: { id: input.categoryId } } : { disconnect: true };
  }
  return data;
}

export const expensesRoutes = new Hono<AppEnv>()
  .use("*", requireAuth)
  .get("/tags", zValidator("query", transactionTagsQuerySchema), async (c) => {
    const tags = await listTransactionTags(c.get("user").id, c.req.valid("query"));
    return c.json({ tags });
  })
  .get("/summary", zValidator("query", transactionSummaryQuerySchema), async (c) => {
    const summary = await transactionRepository.summary(c.get("user").id, c.req.valid("query"));
    return c.json(summary);
  })
  .get("/", zValidator("query", transactionFiltersSchema), async (c) => {
    const filters = c.req.valid("query");
    const transactions = await transactionRepository.list(c.get("user").id, filters);
    return c.json(transactions.map(serializeTransaction));
  })
  .get("/:id", async (c) => {
    const transaction = await transactionRepository.findById(c.get("user").id, c.req.param("id"));
    if (!transaction) throw new NotFoundError("Transaction not found");
    return c.json(serializeTransaction(transaction));
  })
  .post("/", zValidator("json", createTransactionSchema), async (c) => {
    const input = c.req.valid("json");
    const transaction = await createTransaction(c.get("user").id, input);
    return c.json(serializeTransaction(transaction), 201);
  })
  .put("/:id", zValidator("json", updateTransactionSchema), async (c) => {
    const id = c.req.param("id");
    const input = c.req.valid("json");
    if (input.categoryId && !(await categoryRepository.findById(c.get("user").id, input.categoryId))) {
      throw new NotFoundError("Category not found");
    }
    const transaction = await transactionRepository.update(
      c.get("user").id,
      id,
      toTxData(input),
    );
    if (!transaction) throw new NotFoundError("Transaction not found");
    return c.json(serializeTransaction(transaction));
  })
  .delete("/:id", async (c) => {
    const id = c.req.param("id");
    const deleted = await transactionRepository.delete(c.get("user").id, id);
    if (!deleted) throw new NotFoundError("Transaction not found");
    return c.json({ ok: true });
  });
