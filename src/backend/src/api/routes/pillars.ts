import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { requireAuth } from "../middlewares/auth.ts";
import { pillarRepository } from "../../repositories/pillar.ts";
import { upsertPillarSchema } from "../../schemas/index.ts";
import { BadRequestError } from "../../core/errors.ts";
import type { AppEnv } from "../types.ts";

export const pillarsRoutes = new Hono<AppEnv>()
  .use("*", requireAuth)
  .get("/", async (c) => {
    const pillars = await pillarRepository.list();
    return c.json(pillars);
  })
  .put("/:position", zValidator("json", upsertPillarSchema), async (c) => {
    const position = Number(c.req.param("position"));
    if (!Number.isInteger(position) || position < 1 || position > 4) {
      throw new BadRequestError("position must be 1-4");
    }
    const pillar = await pillarRepository.upsert(position, c.req.valid("json"));
    return c.json(pillar);
  });
