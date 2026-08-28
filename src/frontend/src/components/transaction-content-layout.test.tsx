import { expect, test } from "bun:test";
import { Children, createElement, type ReactElement } from "react";
import { TransactionContentLayout } from "./transaction-content-layout";

test("keeps sidebar widgets after movements when no period summary is active", () => {
  const layout = TransactionContentLayout({
    summary: null,
    sidebar: createElement("span", null, "sidebar"),
    movements: createElement("span", null, "movements"),
  });
  const children = Children.toArray((layout.props as { children: ReactElement[] }).children) as ReactElement[];
  const [movements, sidebar] = children;

  expect(children.map((child) => child.type)).toEqual(["div", "aside"]);
  expect(sidebar.type).toBe("aside");
  expect(movements.props.className).toContain("lg:col-start-1");
  expect(sidebar.props.className).toContain("lg:col-start-10");
  expect(sidebar.props.className).toContain("lg:sticky lg:top-4");
});

test("emits the bounded-period summary before movements in DOM order", () => {
  const layout = TransactionContentLayout({
    summary: createElement("span", null, "summary"),
    sidebar: createElement("span", null, "sidebar"),
    movements: createElement("span", null, "movements"),
  });
  const children = Children.toArray((layout.props as { children: ReactElement[] }).children) as ReactElement[];
  const [summary, movements, sidebar] = children;

  expect(children.map((child) => child.type)).toEqual(["section", "div", "aside"]);
  expect(summary.type).toBe("section");
  expect(sidebar.type).toBe("aside");
  expect(summary.props.className).toContain("lg:col-span-12");
  expect(summary.props.className).toContain("lg:col-start-1");
  expect(movements.props.className).toContain("lg:col-start-1");
  expect(movements.props.className).toContain("lg:col-span-9");
  expect(movements.props.className).toContain("lg:row-start-2");
  expect(sidebar.props.className).toContain("lg:row-start-2");
  expect(sidebar.props.className).toContain("lg:sticky lg:top-4");
});
