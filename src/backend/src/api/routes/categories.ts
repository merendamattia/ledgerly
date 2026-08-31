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
import { ConflictError, NotFoundError } from "../../core/errors.ts";
import { normalizeCategoryName } from "../../utils/category.ts";
import type { AppEnv } from "../types.ts";

export const categoriesRoutes = new Hono<AppEnv>()
  .use("*", requireAuth)
  .get("/", zValidator("query", z.object({ kind: categoryKindSchema.optional() })), async (c) => {
    const { kind } = c.req.valid("query");
    return c.json(await categoryRepository.list(c.get("user").id, kind));
  })
  .delete("/unused", async (c) => {
    const { count } = await categoryRepository.deleteUnused(c.get("user").id);
    return c.json({ ok: true, count });
  })
  .post("/", zValidator("json", createCategorySchema), async (c) => {
    const input = c.req.valid("json");
    const name = normalizeCategoryName(input.name);
    if (await categoryRepository.findByNameKind(c.get("user").id, name, input.kind)) {
      throw new ConflictError("A category with this name already exists");
    }
    const category = await categoryRepository.create(c.get("user").id, {
      name,
      kind: input.kind,
      emoji: input.emoji,
    });
    return c.json(category, 201);
  })
  .put("/:id", zValidator("json", updateCategorySchema), async (c) => {
    const id = c.req.param("id");
    const existing = await categoryRepository.findById(c.get("user").id, id);
    if (!existing) throw new NotFoundError("Category not found");
    const input = c.req.valid("json");
    const name = input.name !== undefined ? normalizeCategoryName(input.name) : undefined;
    if (name && name !== existing.name) {
      const clash = await categoryRepository.findByNameKind(c.get("user").id, name, existing.kind);
      if (clash && clash.id !== id) {
        throw new ConflictError("A category with this name already exists");
      }
    }
    const category = await categoryRepository.update(c.get("user").id, id, { ...input, name });
    if (!category) throw new NotFoundError("Category not found");
    return c.json(category);
  })
  .delete("/:id", async (c) => {
    const id = c.req.param("id");
    const existing = await categoryRepository.findById(c.get("user").id, id);
    if (!existing) throw new NotFoundError("Category not found");
    await categoryRepository.delete(c.get("user").id, id);
    return c.json({ ok: true });
  });
