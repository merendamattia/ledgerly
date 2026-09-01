import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { requireAuth } from "../middlewares/auth.ts";
import { settingsRepository } from "../../repositories/settings.ts";
import { acknowledgeReleaseSchema, updateSettingsSchema } from "../../schemas/index.ts";
import type { AppEnv } from "../types.ts";

export const settingsRoutes = new Hono<AppEnv>()
  .use("*", requireAuth)
  .get("/", async (c) => c.json(await settingsRepository.get(c.get("user").id)))
  .put("/", zValidator("json", updateSettingsSchema), async (c) => {
    const data = c.req.valid("json");
    return c.json(await settingsRepository.update(c.get("user").id, data));
  })
  .post("/release-acknowledgement", zValidator("json", acknowledgeReleaseSchema), async (c) => {
    const { version } = c.req.valid("json");
    return c.json(await settingsRepository.acknowledgeRelease(c.get("user").id, version));
  });
