import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { requireAuth } from "../middlewares/auth.ts";
import { categoryRepository } from "../../repositories/category.ts";
import {
  categoryKindSchema,
  createCategorySchema,
  updateCategorySchema,
} from "../../schemas/index.ts";
import { NotFoundError } from "../../core/errors.ts";
import type { AppEnv } from "../types.ts";

export const categoriesRoutes = new Hono<AppEnv>()
  .use("*", requireAuth)
  .get("/", zValidator("query", z.object({ kind: categoryKindSchema.optional() })), async (c) => {
    const { kind } = c.req.valid("query");
    return c.json(await categoryRepository.list(kind));
  })
  .delete("/unused", async (c) => {
    const { count } = await categoryRepository.deleteUnused();
    return c.json({ ok: true, count });
  })
  .post("/", zValidator("json", createCategorySchema), async (c) => {
    const input = c.req.valid("json");
    const category = await categoryRepository.create({
      name: input.name,
      kind: input.kind,
      color: input.color ?? null,
    });
    return c.json(category, 201);
  })
  .put("/:id", zValidator("json", updateCategorySchema), async (c) => {
    const id = c.req.param("id");
    const existing = await categoryRepository.findById(id);
    if (!existing) throw new NotFoundError("Category not found");
    return c.json(await categoryRepository.update(id, c.req.valid("json")));
  })
  .delete("/:id", async (c) => {
    const id = c.req.param("id");
    const existing = await categoryRepository.findById(id);
    if (!existing) throw new NotFoundError("Category not found");
    await categoryRepository.delete(id);
    return c.json({ ok: true });
  });
