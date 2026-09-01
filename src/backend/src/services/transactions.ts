import type { TxDirection } from "@prisma/client";
import { NotFoundError } from "../core/errors.ts";
import { categoryRepository } from "../repositories/category.ts";
import { transactionRepository } from "../repositories/transaction.ts";

export type CreateTransactionInput = {
  categoryId?: string | null;
  date: Date;
  amount: number;
  direction: TxDirection;
  note?: string | null;
};

/** Creates one transaction after enforcing the owner's category boundary. */
export async function createTransaction(userId: string, input: CreateTransactionInput) {
  if (input.categoryId && !(await categoryRepository.findById(userId, input.categoryId))) {
    throw new NotFoundError("Category not found");
  }
  return transactionRepository.create(userId, {
    date: input.date,
    amount: input.amount,
    direction: input.direction,
    note: input.note ?? null,
    category: input.categoryId ? { connect: { id: input.categoryId } } : undefined,
  });
}
