import { createAuthClient } from "better-auth/react";

// Better Auth client pointed at the backend. The backend serves auth under
// /api/auth (Better Auth's default base path).
const baseURL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export const authClient = createAuthClient({ baseURL });

export const { signIn, signOut } = authClient;

type AccessUser = NonNullable<ReturnType<typeof authClient.useSession>["data"]>["user"] & {
  role?: string;
  mustChangePassword?: boolean;
};

/** Adds Ledgerly's role and onboarding fields to Better Auth's client session type. */
export function useSession() {
  const result = authClient.useSession();
  return {
    ...result,
    data: result.data
      ? { ...result.data, user: result.data.user as AccessUser }
      : result.data,
  };
}
