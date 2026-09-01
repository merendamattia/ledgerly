import { expect, test } from "bun:test";
import { DEFAULT_LOCALE, getMessages, isLocale } from "./config";

test("English and Italian resolve messages with English fallback", () => {
  expect(DEFAULT_LOCALE).toBe("en");
  expect(getMessages("en").common.save).toBe("Save");
  expect(getMessages("it").common.save).toBe("Salva");
  expect(getMessages("it").common.appName).toBe("Ledgerly");
});

test("only registered locales are accepted", () => {
  expect(isLocale("en")).toBe(true);
  expect(isLocale("it")).toBe(true);
  expect(isLocale("fr")).toBe(false);
});
