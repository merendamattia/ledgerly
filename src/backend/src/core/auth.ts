import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { admin } from "better-auth/plugins";
import { prisma } from "./db.ts";
import { config } from "./config.ts";

// Better Auth instance (email/password, Prisma adapter). Public registration is
// disabled; the bootstrap path and the admin-only users route use Better Auth's
// server-side account-management APIs instead.
export const auth = betterAuth({
  appName: "Ledgerly",
  secret: config.BETTER_AUTH_SECRET,
  baseURL: config.BETTER_AUTH_URL,
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  emailAndPassword: {
    enabled: true,
    disableSignUp: true,
  },
  user: {
    additionalFields: {
      mustChangePassword: {
        type: "boolean",
        defaultValue: false,
        input: false,
      },
    },
  },
  databaseHooks: {
    user: {
      create: {
        before: async (user) => ({
          data: { ...user, mustChangePassword: true },
        }),
      },
    },
  },
  plugins: [admin()],
  trustedOrigins: [config.FRONTEND_URL],
  advanced: {
    useSecureCookies: process.env.NODE_ENV === "production",
  },
});

export type Session = typeof auth.$Infer.Session;
