import { expect, test } from "bun:test";
import { createElement, type ReactElement } from "react";
import { TransactionContentLayout } from "./transaction-content-layout";

test("puts the period summary before movements on mobile and keeps the sidebar on desktop", () => {
  const layout = TransactionContentLayout({
    summary: createElement("span", null, "summary"),
    movements: createElement("span", null, "movements"),
  });
  const [summary, movements] = (layout.props as { children: ReactElement[] }).children;

  expect(summary.type).toBe("aside");
  expect(summary.props.className).toContain("lg:col-span-3");
  expect(summary.props.className).toContain("lg:col-start-10");
  expect(summary.props.className).toContain("lg:row-start-1");
  expect(movements.type).toBe("div");
  expect(movements.props.className).toContain("lg:col-span-9");
  expect(movements.props.className).toContain("lg:col-start-1");
  expect(movements.props.className).toContain("lg:row-start-1");
});
