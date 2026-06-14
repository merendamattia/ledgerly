import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { createAuthMiddleware, APIError } from "better-auth/api";
import { prisma } from "./db.ts";
import { config } from "./config.ts";

// Better Auth instance (email/password, Prisma adapter).
// This is a single-user app: sign-up is allowed only while no user exists,
// which lets the startup bootstrap create the admin and blocks everyone else.
export const auth = betterAuth({
  appName: "Ledgerly",
  secret: config.BETTER_AUTH_SECRET,
  baseURL: config.BETTER_AUTH_URL,
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  emailAndPassword: {
    enabled: true,
  },
  trustedOrigins: [config.FRONTEND_URL],
  advanced: {
    useSecureCookies: process.env.NODE_ENV === "production",
  },
  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      if (ctx.path === "/sign-up/email") {
        const userCount = await prisma.user.count();
        if (userCount > 0) {
          throw new APIError("FORBIDDEN", {
            message: "Sign up is disabled: this instance already has a user.",
          });
        }
      }
    }),
  },
});

export type Session = typeof auth.$Infer.Session;
