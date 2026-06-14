import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { requireAuth } from "../middlewares/auth.ts";
import { databaseRepository } from "../../repositories/database.ts";
import { NotFoundError } from "../../core/errors.ts";
import type { AppEnv } from "../types.ts";

const tableQuerySchema = z.object({
  search: z.string().trim().optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

// Read-only database browser. Lists public tables and returns their rows with
// search + pagination. No write endpoints by design.
export const databaseRoutes = new Hono<AppEnv>()
  .use("*", requireAuth)
  .get("/tables", async (c) => {
    return c.json({ tables: await databaseRepository.listTables() });
  })
  .get("/tables/:table", zValidator("query", tableQuerySchema), async (c) => {
    const table = c.req.param("table");
    const { search, limit, offset } = c.req.valid("query");
    const result = await databaseRepository.read(table, {
      search,
      limit: limit ?? 50,
      offset: offset ?? 0,
    });
    if (!result) throw new NotFoundError("Table not found");
    return c.json(result);
  });
