import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { requireAuth } from "../middlewares/auth.ts";
import { snapshotImportCommitSchema } from "../../schemas/index.ts";
import { snapshotImportService } from "../../services/snapshotImport.ts";
import { parseSnapshotCsv } from "../../utils/snapshot-csv.ts";
import { BadRequestError } from "../../core/errors.ts";
import type { AppEnv } from "../types.ts";

// Bulk snapshot import (wide `date,account1,account2,…` CSV/TSV). Two steps so the
// UI can map each column to an account/debt (or create one) before persisting:
// `parse` returns the header + raw grid (no DB write); `commit` resolves the
// mapping, creates any new accounts, and upserts the dated snapshots.
export const snapshotImportRoutes = new Hono<AppEnv>()
  .use("*", requireAuth)
  .post("/parse", async (c) => {
    const body = await c.req.parseBody();
    const file = body["file"];
    if (!(file instanceof File)) throw new BadRequestError("Expected a file upload");
    const { headers, rows } = parseSnapshotCsv(await file.arrayBuffer());
    if (headers.length < 2) {
      throw new BadRequestError("Expected a header row with a date column and at least one account");
    }
    return c.json({ headers, rows });
  })
  .post("/commit", zValidator("json", snapshotImportCommitSchema), async (c) => {
    const result = await snapshotImportService.commit(c.get("user").id, c.req.valid("json"));
    return c.json(result, 201);
  });
