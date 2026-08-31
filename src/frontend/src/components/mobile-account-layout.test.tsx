import { expect, test } from "bun:test";
import type { ReactElement } from "react";
import {
  ACCOUNT_BALANCE_ROW_CLASS,
  ACCOUNT_TILE_CLASS,
  ACCOUNT_TYPE_BADGE_CLASS,
} from "./mobile-account-layout";
import { Input } from "./ui/input";

test("account cards stack balance content before it can overflow a phone viewport", () => {
  expect(ACCOUNT_TILE_CLASS).toContain("min-w-0");
  expect(ACCOUNT_BALANCE_ROW_CLASS).toContain("grid-cols-1");
  expect(ACCOUNT_BALANCE_ROW_CLASS).toContain(
    "sm:grid-cols-[minmax(0,1fr)_auto]",
  );
  expect(ACCOUNT_TYPE_BADGE_CLASS).toContain("max-w-full");
  expect(ACCOUNT_TYPE_BADGE_CLASS).toContain("break-words");
});

test("native date inputs cannot exceed their parent width", () => {
  const input = Input({ type: "date" }) as ReactElement<{ className: string }>;

  expect(input.props.className).toContain("min-w-0");
  expect(input.props.className).toContain("max-w-full");
});
