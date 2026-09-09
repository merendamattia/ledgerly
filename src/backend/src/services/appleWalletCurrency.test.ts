import { expect, mock, test } from "bun:test";
import { convertWalletAmount, type FxRateOn } from "./appleWalletCurrency.ts";

const transactionDate = new Date("2026-09-01T00:00:00.000Z");

test("keeps a transaction amount unchanged when Wallet and Ledgerly use the same currency", async () => {
  const getRateOn = mock<FxRateOn>();

  const amount = await convertWalletAmount({
    amount: 12.5,
    sourceCurrency: "EUR",
    baseCurrency: "EUR",
    transactionDate,
    getRateOn,
  });

  expect(amount).toBe(12.5);
  expect(getRateOn).not.toHaveBeenCalled();
});

test("converts JPY to EUR with the rate for the Wallet transaction date", async () => {
  const getRateOn = mock<FxRateOn>(async (base, quote, date) => {
    expect({ base, quote, date }).toEqual({
      base: "JPY",
      quote: "EUR",
      date: transactionDate,
    });
    return 0.0067;
  });

  await expect(
    convertWalletAmount({
      amount: 1_500,
      sourceCurrency: "JPY",
      baseCurrency: "EUR",
      transactionDate,
      getRateOn,
    }),
  ).resolves.toBe(10.05);
});

test("converts GBP to EUR and rounds the persisted amount to two decimals", async () => {
  const getRateOn = mock<FxRateOn>(async () => 1.17654);

  await expect(
    convertWalletAmount({
      amount: 10,
      sourceCurrency: "GBP",
      baseCurrency: "EUR",
      transactionDate,
      getRateOn,
    }),
  ).resolves.toBe(11.77);
});

test("converts JPY to USD through the configured FX lookup", async () => {
  const getRateOn = mock<FxRateOn>(async () => 0.0068);

  await expect(
    convertWalletAmount({
      amount: 1_500,
      sourceCurrency: "JPY",
      baseCurrency: "USD",
      transactionDate,
      getRateOn,
    }),
  ).resolves.toBe(10.2);
});

test("propagates an unavailable FX rate instead of returning a foreign amount", async () => {
  const getRateOn = mock<FxRateOn>(async () => {
    throw new Error("No FX rate available for JPY -> EUR");
  });

  await expect(
    convertWalletAmount({
      amount: 1_500,
      sourceCurrency: "JPY",
      baseCurrency: "EUR",
      transactionDate,
      getRateOn,
    }),
  ).rejects.toThrow("No FX rate available for JPY -> EUR");
});
