import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { auth } from "../../core/auth.ts";
import { ConflictError, BadRequestError } from "../../core/errors.ts";
import { provisionUser } from "../../services/userProvisioning.ts";
import { userRepository } from "../../repositories/user.ts";
import { changePasswordSchema, createUserSchema } from "../../schemas/index.ts";
import { requireAdmin, requireAuth } from "../middlewares/auth.ts";
import type { AppEnv } from "../types.ts";

export const usersRoutes = new Hono<AppEnv>()
  .get("/", requireAuth, requireAdmin, async (c) => c.json(await userRepository.list()))
  .post(
    "/",
    requireAuth,
    requireAdmin,
    zValidator("json", createUserSchema),
    async (c) => {
      const input = c.req.valid("json");
      if (await userRepository.findByEmail(input.email)) {
        throw new ConflictError("A user with this email already exists");
      }

      try {
        const { user } = await auth.api.createUser({
          headers: c.req.raw.headers,
          body: {
            email: input.email,
            password: input.password,
            name: input.name ?? input.email.split("@")[0],
            role: "user",
          },
        });
        await userRepository.setMustChangePassword(user.id, true);
        await provisionUser(user.id, c.get("user").id);
        return c.json(await userRepository.findById(user.id), 201);
      } catch (error) {
        if (error instanceof ConflictError) throw error;
        throw new BadRequestError("Unable to create user");
      }
    },
  )
  .post("/password", requireAuth, zValidator("json", changePasswordSchema), async (c) => {
    const { currentPassword, newPassword } = c.req.valid("json");
    try {
      const response = await auth.api.changePassword({
        headers: c.req.raw.headers,
        body: { currentPassword, newPassword, revokeOtherSessions: true },
        asResponse: true,
      });
      if (!response.ok) throw new Error("Password change rejected");
      const setCookie = response.headers.get("set-cookie");
      if (setCookie) c.header("set-cookie", setCookie);
    } catch {
      throw new BadRequestError("Current password is incorrect");
    }
    return c.json(await userRepository.setMustChangePassword(c.get("user").id, false));
  });
