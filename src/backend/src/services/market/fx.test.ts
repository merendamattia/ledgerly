import { expect, mock, test } from "bun:test";
import { getStoredFxRate } from "./fx.ts";

test("a cold stored FX lookup does not call a provider", async () => {
  const latest = mock(async () => null);
  const originalFetch = globalThis.fetch;
  const providerFetch = mock(async () => {
    throw new Error("provider must not be called");
  });
  globalThis.fetch = providerFetch as unknown as typeof fetch;

  try {
    expect(await getStoredFxRate("USD", "EUR", { latest })).toBeNull();
    expect(latest).toHaveBeenCalledTimes(1);
    expect(providerFetch).not.toHaveBeenCalled();
  } finally {
    globalThis.fetch = originalFetch;
  }
});
