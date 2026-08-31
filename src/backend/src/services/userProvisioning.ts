import { userProvisioningRepository } from "../repositories/userProvisioning.ts";

export type UserSettingsCategory = {
  name: string;
  kind: "INCOME" | "EXPENSE";
  emoji: string | null;
};

export type UserSettingsDefaults = {
  baseCurrency: string;
  categories: UserSettingsCategory[];
};

/**
 * Copies every currently user-configurable setting into a detached snapshot.
 * Add future user-configurable fields here so all account provisioning paths
 * continue to use the same defaults contract.
 */
export function buildUserSettingsDefaults(source: UserSettingsDefaults): UserSettingsDefaults {
  return {
    baseCurrency: source.baseCurrency,
    categories: source.categories.map((category) => ({ ...category })),
  };
}

async function loadDefaults(userId: string): Promise<UserSettingsDefaults> {
  const [settings, categories] = await Promise.all([
    userProvisioningRepository.findSettings(userId),
    userProvisioningRepository.listCategories(userId),
  ]);

  return buildUserSettingsDefaults({
    baseCurrency: settings?.baseCurrency ?? "EUR",
    categories: categories.map(({ name, kind, emoji }) => ({ name, kind, emoji })),
  });
}

/** Returns whether the account has a durable settings record to use. */
export async function isUserProvisioned(userId: string): Promise<boolean> {
  return (await userProvisioningRepository.findSettings(userId)) !== null;
}

/**
 * Idempotently creates a user's settings and independent category copies.
 * Existing settings are never overwritten, making this safe during bootstrap
 * retries and after a partially completed deployment.
 */
export async function provisionUser(
  userId: string,
  defaultsFromUserId?: string,
): Promise<void> {
  const existing = await userProvisioningRepository.findSettings(userId);
  if (existing) return;

  const defaults = defaultsFromUserId
    ? await loadDefaults(defaultsFromUserId)
    : buildUserSettingsDefaults({ baseCurrency: "EUR", categories: [] });

  await userProvisioningRepository.createIfMissing(userId, defaults);
}
