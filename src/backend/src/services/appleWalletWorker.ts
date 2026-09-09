import { appleWalletImportRepository } from "../repositories/appleWalletImport.ts";
import { invalidateTransactionTagCache } from "./transactionTagCache.ts";
import { convertWalletAmount } from "./appleWalletCurrency.ts";
import {
  normalizeAppleWalletTransaction,
  type NormalizedWalletTransaction,
  type WalletCategory,
} from "./appleWalletNormalizer.ts";
import { getFxRateOn } from "./market/fx.ts";
import { sendTransactionPush } from "./webPush.ts";

type Normalize = (input: {
  userId: string;
  rawPayload: unknown;
  receivedAt: Date;
  baseCurrency: string;
  categories: WalletCategory[];
}) => Promise<NormalizedWalletTransaction>;

/** Claims and processes one queued import. Duplicate delivery is a no-op. */
export async function processAppleWalletImport(
  importId: string,
  attempt: number,
  maxAttempts: number,
  normalize: Normalize = normalizeAppleWalletTransaction,
) {
  const record = await appleWalletImportRepository.claim(importId);
  if (!record) return "IGNORED" as const;

  const heartbeat = setInterval(() => {
    void appleWalletImportRepository.heartbeat(importId, record.attempts);
  }, 10_000);

  try {
    const settings = record.user.settings[0];
    const baseCurrency = settings?.baseCurrency ?? "EUR";
    const normalized = await normalize({
      userId: record.userId,
      rawPayload: record.rawPayload,
      receivedAt: record.createdAt,
      baseCurrency,
      categories: record.user.categories.map(({ id, name, kind }) => ({ id, name, kind })),
    });
    const date = new Date(`${normalized.date}T00:00:00.000Z`);
    if (Number.isNaN(date.getTime())) throw new Error("OpenAI returned an invalid transaction date");
    const amount = await convertWalletAmount({
      amount: normalized.amount,
      sourceCurrency: normalized.sourceCurrency,
      baseCurrency,
      transactionDate: date,
      getRateOn: getFxRateOn,
    });
    const completed = await appleWalletImportRepository.complete(importId, record.attempts, {
      date,
      amount,
      direction: normalized.direction,
      note: normalized.note,
      categoryId: normalized.categoryId,
    });
    if (!completed) return "IGNORED" as const;
    await invalidateTransactionTagCache();
    await sendTransactionPush(record.userId, completed.transaction.id, {
      amount: Number(completed.transaction.amount),
      currency: baseCurrency,
      direction: completed.transaction.direction,
      locale: settings?.locale,
    });
    return "COMPLETED" as const;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Apple Wallet import failed";
    if (attempt >= maxAttempts) await appleWalletImportRepository.fail(importId, record.attempts, message);
    else await appleWalletImportRepository.retry(importId, record.attempts, message);
    throw error;
  } finally {
    clearInterval(heartbeat);
  }
}
