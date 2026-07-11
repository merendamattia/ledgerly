import { expect, test } from "bun:test";
import { matchTrades } from "./rebalance";

test("matchTrades routes sell proceeds into buys, splitting across both", () => {
  const plan = matchTrades(
    [{ key: "a", name: "A", amount: 1000 }],
    [
      { key: "b", name: "B", amount: 600 },
      { key: "c", name: "C", amount: 400 },
    ],
  );
  expect(plan.transfers).toEqual([
    { from: "A", to: "B", amount: 600 },
    { from: "A", to: "C", amount: 400 },
  ]);
  expect(plan.freeCash).toBe(0);
  expect(plan.needCash).toBe(0);
});

test("matchTrades reports leftover when sells and buys don't balance", () => {
  const sellHeavy = matchTrades(
    [{ key: "a", name: "A", amount: 1000 }],
    [{ key: "b", name: "B", amount: 300 }],
  );
  expect(sellHeavy.transfers).toEqual([{ from: "A", to: "B", amount: 300 }]);
  expect(sellHeavy.freeCash).toBe(700);
  expect(sellHeavy.needCash).toBe(0);

  const buyHeavy = matchTrades(
    [{ key: "a", name: "A", amount: 200 }],
    [{ key: "b", name: "B", amount: 500 }],
  );
  expect(buyHeavy.needCash).toBe(300);
  expect(buyHeavy.freeCash).toBe(0);
});
