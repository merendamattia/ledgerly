export type FxRateOn = (base: string, quote: string, date: Date) => Promise<number>;

type WalletAmountConversion = {
  amount: number;
  sourceCurrency: string;
  baseCurrency: string;
  transactionDate: Date;
  getRateOn: FxRateOn;
};

/** Converts a Wallet amount into Ledgerly's base currency using a date-aware rate. */
export async function convertWalletAmount(input: WalletAmountConversion): Promise<number> {
  if (input.sourceCurrency === input.baseCurrency) return input.amount;

  const rate = await input.getRateOn(
    input.sourceCurrency,
    input.baseCurrency,
    input.transactionDate,
  );
  if (!Number.isFinite(rate) || rate <= 0) {
    throw new Error(`Invalid FX rate for ${input.sourceCurrency} -> ${input.baseCurrency}`);
  }

  return Math.round((input.amount * rate + Number.EPSILON) * 100) / 100;
}
