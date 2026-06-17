import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { requireAuth } from "../middlewares/auth.ts";
import {
  importInvestmentTxCommitSchema,
  investmentImportColumnMapSchema,
} from "../../schemas/index.ts";
import { investmentImportService } from "../../services/investmentImport.ts";
import { parseInvestmentCsv } from "../../utils/investment-csv.ts";
import { BadRequestError } from "../../core/errors.ts";
import type { AppEnv } from "../types.ts";

// Investment-transaction import (broker CSV/TSV export). Two steps so the UI can
// preview rows and map the raw ticker/broker strings to real records before they
// are persisted: `parse` returns the parsed rows + parse errors (no DB write),
// `commit` inserts the mapped rows, skipping duplicates.
export const investmentImportRoutes = new Hono<AppEnv>()
  .use("*", requireAuth)
  .post("/parse", async (c) => {
    const body = await c.req.parseBody();
    const file = body["file"];
    const mappingRaw = body["mapping"];
    if (!(file instanceof File)) throw new BadRequestError("Expected a file upload");
    let mapping;
    if (typeof mappingRaw === "string" && mappingRaw.trim().length > 0) {
      try {
        mapping = investmentImportColumnMapSchema.parse(JSON.parse(mappingRaw));
      } catch {
        throw new BadRequestError("Invalid investment import mapping");
      }
    }
    const { rows, errors } = parseInvestmentCsv(await file.arrayBuffer(), mapping);
    return c.json({ rows, errors });
  })
  .post("/commit", zValidator("json", importInvestmentTxCommitSchema), async (c) => {
    const { rows } = c.req.valid("json");
    const result = await investmentImportService.commit(rows);
    return c.json(result, 201);
  });
