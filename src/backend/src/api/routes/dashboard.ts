import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { requireAuth } from "../middlewares/auth.ts";
import { getDashboardData } from "../../services/dashboard.ts";
import { computeNetWorthHistory } from "../../services/netWorthHistory.ts";
import { computeAssetMatrix } from "../../services/assetMatrix.ts";
import { computeAssetReturnMatrix } from "../../services/assetReturnMatrix.ts";
import { computeCashflowMatrix } from "../../services/cashflowMatrix.ts";
import { dashboardQuerySchema } from "../../schemas/index.ts";
import type { AppEnv } from "../types.ts";

export const dashboardRoutes = new Hono<AppEnv>()
  .use("*", requireAuth)
  .get("/networth-history", async (c) => {
    const points = await computeNetWorthHistory(c.get("user").id);
    return c.json(points);
  })
  .get("/asset-matrix", async (c) => c.json(await computeAssetMatrix(c.get("user").id)))
  .get("/asset-return-matrix", async (c) =>
    c.json(await computeAssetReturnMatrix(c.get("user").id)),
  )
  .get("/cashflow-matrix", async (c) => c.json(await computeCashflowMatrix(c.get("user").id)))
  .get("/", zValidator("query", dashboardQuerySchema), async (c) => {
    const data = await getDashboardData(c.get("user").id, c.req.valid("query").months ?? 6);
    return c.json(data);
  });
