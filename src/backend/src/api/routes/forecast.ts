import { Hono } from "hono";
import { readForecast, requestForecastGeneration } from "../../services/forecastGeneration.ts";
import { requireAuth } from "../middlewares/auth.ts";
import type { AppEnv } from "../types.ts";

export const forecastRoutes = new Hono<AppEnv>()
  .use("*", requireAuth)
  .get("/", async (c) => c.json(await readForecast(c.get("user").id)))
  .post("/", async (c) => c.json(await requestForecastGeneration(c.get("user").id), 202));
