import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { requireAuth } from "../middlewares/auth.ts";
import { importCommitSchema } from "../../schemas/index.ts";
import { importService } from "../../services/import.ts";
import { parseBudjetExport } from "../../utils/budjet-csv.ts";
import { BadRequestError } from "../../core/errors.ts";
import type { AppEnv } from "../types.ts";

// Transaction import (Budjet CSV). Two steps so the UI can preview/edit rows
// before they are persisted: `parse` returns the parsed rows + parse errors
// (no DB write), `commit` inserts the (possibly edited) rows, skipping dupes.
export const importRoutes = new Hono<AppEnv>()
  .use("*", requireAuth)
  .post("/parse", async (c) => {
    const body = await c.req.parseBody();
    const file = body["file"];
    if (!(file instanceof File)) throw new BadRequestError("Expected a file upload");
    const { rows, errors } = parseBudjetExport(await file.arrayBuffer());
    return c.json({ rows, errors });
  })
  .post("/commit", zValidator("json", importCommitSchema), async (c) => {
    const { rows } = c.req.valid("json");
    const result = await importService.commit(c.get("user").id, rows);
    return c.json(result, 201);
  });
