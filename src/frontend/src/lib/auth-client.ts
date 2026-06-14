import { createAuthClient } from "better-auth/react";

// Better Auth client pointed at the backend. The backend serves auth under
// /api/auth (Better Auth's default base path).
const baseURL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export const authClient = createAuthClient({ baseURL });

export const { signIn, signOut, useSession } = authClient;
