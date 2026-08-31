import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import type { Prisma } from "@prisma/client";
import { requireAuth } from "../middlewares/auth.ts";
import { recurringExpenseRepository } from "../../repositories/recurringExpense.ts";
import { categoryRepository } from "../../repositories/category.ts";
import { createRecurringSchema, updateRecurringSchema } from "../../schemas/index.ts";
import { serializeRecurringExpense } from "../../utils/serialize.ts";
import { NotFoundError } from "../../core/errors.ts";
import type { AppEnv } from "../types.ts";

type RecurInput = Partial<{
  categoryId: string | null;
  amount: number;
  direction: "INCOME" | "EXPENSE";
  note: string | null;
  intervalUnit: "DAY" | "WEEK" | "MONTH";
  intervalCount: number;
  startDate: Date;
  endMode: "NEVER" | "AFTER_OCCURRENCES" | "ON_DATE";
  maxOccurrences: number | null;
  endDate: Date | null;
  enabled: boolean;
}>;

/**
 * Maps a validated recurring-rule payload to Prisma update data.
 *
 * When startDate changes, nextRunDate is realigned to the new start because
 * rules are edited before they run.
 */
function toData(input: RecurInput): Prisma.RecurringExpenseUpdateInput {
  const data: Prisma.RecurringExpenseUpdateInput = {};
  if (input.amount !== undefined) data.amount = input.amount;
  if (input.direction !== undefined) data.direction = input.direction;
  if (input.note !== undefined) data.note = input.note;
  if (input.intervalUnit !== undefined) data.intervalUnit = input.intervalUnit;
  if (input.intervalCount !== undefined) data.intervalCount = input.intervalCount;
  if (input.startDate !== undefined) {
    data.startDate = input.startDate;
    data.nextRunDate = input.startDate;
  }
  if (input.endMode !== undefined) data.endMode = input.endMode;
  if (input.maxOccurrences !== undefined) data.maxOccurrences = input.maxOccurrences;
  if (input.endDate !== undefined) data.endDate = input.endDate;
  if (input.enabled !== undefined) data.enabled = input.enabled;
  if (input.categoryId !== undefined) {
    data.category = input.categoryId ? { connect: { id: input.categoryId } } : { disconnect: true };
  }
  return data;
}

export const recurringRoutes = new Hono<AppEnv>()
  .use("*", requireAuth)
  .get("/", async (c) => {
    const rules = await recurringExpenseRepository.list(c.get("user").id);
    return c.json(rules.map(serializeRecurringExpense));
  })
  .post("/", zValidator("json", createRecurringSchema), async (c) => {
    const input = c.req.valid("json");
    if (input.categoryId && !(await categoryRepository.findById(c.get("user").id, input.categoryId))) {
      throw new NotFoundError("Category not found");
    }
    const rule = await recurringExpenseRepository.create(c.get("user").id, {
      amount: input.amount,
      direction: input.direction,
      note: input.note ?? null,
      intervalUnit: input.intervalUnit,
      intervalCount: input.intervalCount,
      startDate: input.startDate,
      nextRunDate: input.startDate,
      endMode: input.endMode,
      maxOccurrences: input.maxOccurrences ?? null,
      endDate: input.endDate ?? null,
      enabled: input.enabled ?? true,
      category: input.categoryId ? { connect: { id: input.categoryId } } : undefined,
    });
    return c.json(serializeRecurringExpense(rule), 201);
  })
  .put("/:id", zValidator("json", updateRecurringSchema), async (c) => {
    const id = c.req.param("id");
    const existing = await recurringExpenseRepository.findById(c.get("user").id, id);
    if (!existing) throw new NotFoundError("Recurring expense not found");
    const input = c.req.valid("json");
    if (input.categoryId && !(await categoryRepository.findById(c.get("user").id, input.categoryId))) {
      throw new NotFoundError("Category not found");
    }
    const rule = await recurringExpenseRepository.update(c.get("user").id, id, toData(input));
    if (!rule) throw new NotFoundError("Recurring expense not found");
    return c.json(serializeRecurringExpense(rule));
  })
  .delete("/:id", async (c) => {
    const id = c.req.param("id");
    const deleted = await recurringExpenseRepository.delete(c.get("user").id, id);
    if (!deleted) throw new NotFoundError("Recurring expense not found");
    return c.json({ ok: true });
  });
