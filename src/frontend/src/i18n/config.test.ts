import { expect, test } from "bun:test";
import { DEFAULT_LOCALE, getMessages, isLocale } from "./config";

test("English and Italian resolve messages with English fallback", () => {
  expect(DEFAULT_LOCALE).toBe("en");
  expect(getMessages("en").common.save).toBe("Save");
  expect(getMessages("it").common.save).toBe("Salva");
  expect(getMessages("it").common.appName).toBe("Ledgerly");
  expect(getMessages("en").analysis.newSimulation).toBe("New simulation");
  expect(getMessages("it").analysis.newSimulation).toBe("Nuova simulazione");
  expect(getMessages("en").analysis.contributions).toBe("Contributions");
  expect(getMessages("it").analysis.contributions).toBe("Contributi");
  expect(getMessages("en").analysis.savingsContribution).toBe("Expected savings contribution");
  expect(getMessages("it").analysis.marketReturnContribution).toBe("Contributo atteso dei rendimenti di mercato");
  expect(getMessages("en").analysis.investmentFallbackAssumption).toContain("insufficiently supported");
  expect(getMessages("it").analysis.investmentFallbackAssumption).toContain("storico insufficiente");
  expect(getMessages("it").analysis.forecastUncertainty).toBe("Incertezza della previsione (P10–P90)");
  expect(getMessages("en").analysis.aiPrivacyHidden).toBe("AI interpretation is hidden while privacy mode is active.");
  expect(getMessages("it").analysis.aiPrivacyHidden).toBe("L'interpretazione AI è nascosta mentre la modalità privacy è attiva.");
});

test("only registered locales are accepted", () => {
  expect(isLocale("en")).toBe(true);
  expect(isLocale("it")).toBe(true);
  expect(isLocale("fr")).toBe(false);
});
