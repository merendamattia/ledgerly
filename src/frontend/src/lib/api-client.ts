import { hc } from "hono/client";
import type { AppType } from "ledgerly-backend/app";

// Typed Hono RPC client. Types are inferred end-to-end from the backend's
// exported AppType, so requests and responses are fully checked at compile time.
// `credentials: "include"` sends the Better Auth session cookie cross-origin.
const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export const api = hc<AppType>(baseUrl, {
  init: { credentials: "include" },
}).api;

/**
 * Unwraps a Hono RPC response, throwing the backend error message on non-2xx.
 */
export async function unwrap<T>(res: {
  ok: boolean;
  json: () => Promise<unknown>;
}): Promise<T> {
  const body = await res.json();
  if (!res.ok) {
    const message =
      body && typeof body === "object" && "error" in body
        ? String((body as { error: unknown }).error)
        : "Request failed";
    throw new Error(message);
  }
  return body as T;
}
