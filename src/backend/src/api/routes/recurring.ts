import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { updateRecurring } from "../../services/recurring.ts";
import { requireAuth } from "../middlewares/auth.ts";
import { recurringExpenseRepository } from "../../repositories/recurringExpense.ts";
import { categoryRepository } from "../../repositories/category.ts";
import { createRecurringSchema, updateRecurringSchema } from "../../schemas/index.ts";
import { serializeRecurringExpense } from "../../utils/serialize.ts";
import { NotFoundError } from "../../core/errors.ts";
import type { AppEnv } from "../types.ts";

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
    const rule = await updateRecurring(c.get("user").id, id, input);
    if (!rule) throw new NotFoundError("Recurring expense not found");
    return c.json(serializeRecurringExpense(rule));
  })
  .delete("/:id", async (c) => {
    const id = c.req.param("id");
    const deleted = await recurringExpenseRepository.delete(c.get("user").id, id);
    if (!deleted) throw new NotFoundError("Recurring expense not found");
    return c.json({ ok: true });
  });
