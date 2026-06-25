import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { requireAuth } from "../middlewares/auth.ts";
import { getDashboardData } from "../../services/dashboard.ts";
import { computeNetWorthHistory } from "../../services/netWorthHistory.ts";
import { dashboardQuerySchema } from "../../schemas/index.ts";
import type { AppEnv } from "../types.ts";

export const dashboardRoutes = new Hono<AppEnv>()
  .use("*", requireAuth)
  .get("/networth-history", async (c) => {
    const points = await computeNetWorthHistory();
    return c.json(points);
  })
  .get("/", zValidator("query", dashboardQuerySchema), async (c) => {
    const data = await getDashboardData(c.req.valid("query").months ?? 6);
    return c.json(data);
  });
