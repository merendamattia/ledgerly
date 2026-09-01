import { useTranslations } from "next-intl";

/** Returns localized labels for Ledgerly-owned API enum values. */
export function useLocaleLabels() {
  const t = useTranslations("enums");
  return {
    directions: { INCOME: t("income"), EXPENSE: t("expense") },
    tickerTypes: {
      ETF: t("etf"),
      EQUITY: t("equity"),
      CRYPTO: t("crypto"),
      BOND: t("bond"),
      COMMODITY: t("commodity"),
    },
    investmentSides: { BUY: t("buy"), SELL: t("sell") },
    cashCategories: {
      LIQUIDITY: t("liquidity"),
      CREDIT: t("credits"),
      OTHER_ASSET: t("otherAssets"),
    },
  };
}
