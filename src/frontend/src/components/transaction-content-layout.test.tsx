import { expect, test } from "bun:test";
import { Children, createElement, type ReactElement } from "react";
import { TransactionContentLayout } from "./transaction-content-layout";

test("keeps sidebar widgets after movements when no period summary is active", () => {
  const layout = TransactionContentLayout({
    summary: null,
    sidebar: createElement("span", null, "sidebar"),
    movements: createElement("span", null, "movements"),
    summaryFirstOnMobile: false,
  });
  const [movements, sidebarContainer] = (layout.props as { children: ReactElement[] }).children;
  const [sidebar] = Children.toArray(sidebarContainer.props.children) as ReactElement[];

  expect(movements.props.className).toContain("order-1");
  expect(sidebarContainer.type).toBe("div");
  expect(sidebar.type).toBe("aside");
  expect(sidebar.props.className).toContain("order-2");
});

test("puts only the bounded-period summary before movements on mobile", () => {
  const layout = TransactionContentLayout({
    summary: createElement("span", null, "summary"),
    sidebar: createElement("span", null, "sidebar"),
    movements: createElement("span", null, "movements"),
    summaryFirstOnMobile: true,
  });
  const [movements, sidebarContainer] = (layout.props as { children: ReactElement[] }).children;
  const [summary, sidebar] = Children.toArray(sidebarContainer.props.children) as ReactElement[];

  expect(movements.props.className).toContain("order-2");
  expect(sidebarContainer.type).toBe("div");
  expect(summary.props.className).toContain("order-1");
  expect(summary.type).toBe("section");
  expect(sidebar.props.className).toContain("order-3");
  expect(sidebar.type).toBe("aside");
  expect(sidebarContainer.props.className).toContain("contents");
  expect(movements.props.className).toContain("lg:col-span-9");
  expect(movements.props.className).toContain("lg:col-start-1");
  expect(movements.props.className).toContain("lg:row-start-1");
  expect(sidebarContainer.props.className).toContain("lg:col-span-3");
  expect(sidebarContainer.props.className).toContain("lg:col-start-10");
  expect(sidebarContainer.props.className).toContain("lg:row-start-1");
});
