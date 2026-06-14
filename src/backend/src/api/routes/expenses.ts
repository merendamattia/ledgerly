import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import type { Prisma } from "@prisma/client";
import { requireAuth } from "../middlewares/auth.ts";
import { transactionRepository } from "../../repositories/transaction.ts";
import {
  createTransactionSchema,
  transactionFiltersSchema,
  updateTransactionSchema,
} from "../../schemas/index.ts";
import { serializeTransaction } from "../../utils/serialize.ts";
import type { AppEnv } from "../types.ts";

type TxInput = Partial<{
  categoryId: string | null;
  date: Date;
  amount: number;
  direction: "INCOME" | "EXPENSE";
  note: string | null;
}>;

// Build Prisma relation-connect data from a validated transaction payload.
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
  .get("/", zValidator("query", transactionFiltersSchema), async (c) => {
    const filters = c.req.valid("query");
    const transactions = await transactionRepository.list(filters);
    return c.json(transactions.map(serializeTransaction));
  })
  .post("/", zValidator("json", createTransactionSchema), async (c) => {
    const input = c.req.valid("json");
    const transaction = await transactionRepository.create({
      date: input.date,
      amount: input.amount,
      direction: input.direction,
      note: input.note ?? null,
      category: input.categoryId ? { connect: { id: input.categoryId } } : undefined,
    });
    return c.json(serializeTransaction(transaction), 201);
  })
  .put("/:id", zValidator("json", updateTransactionSchema), async (c) => {
    const id = c.req.param("id");
    const transaction = await transactionRepository.update(id, toTxData(c.req.valid("json")));
    return c.json(serializeTransaction(transaction));
  })
  .delete("/:id", async (c) => {
    const id = c.req.param("id");
    await transactionRepository.delete(id);
    return c.json({ ok: true });
  });
