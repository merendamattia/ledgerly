import type { auth } from "../core/auth.ts";

// Shared Hono environment: request-scoped variables set by the auth middleware.
export type AuthUser = (typeof auth.$Infer.Session)["user"];
export type AuthSession = (typeof auth.$Infer.Session)["session"];

export type AppEnv = {
  Variables: {
    requestId: string;
    user: AuthUser;
    session: AuthSession;
    integrationUserId: string;
  };
};
