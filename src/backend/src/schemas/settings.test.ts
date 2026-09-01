import { expect, test } from "bun:test";
import { updateSettingsSchema } from "./index.ts";

test("settings accept registered locales and reject arbitrary values", () => {
  expect(updateSettingsSchema.parse({ locale: "it" })).toEqual({ locale: "it" });
  expect(() => updateSettingsSchema.parse({ locale: "fr" })).toThrow();
});
