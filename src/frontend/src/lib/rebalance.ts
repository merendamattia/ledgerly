// Pairing logic for the "rebalance now" plan: greedily route each euro freed by
// an over-weighted (sell) position into an under-weighted (buy) one.

export interface TradeLeg {
  key: string;
  name: string;
  amount: number; // positive magnitude to sell / to buy
}

export interface Transfer {
  from: string; // sell source
  to: string; // buy destination
  amount: number;
}

export interface RebalancePlan {
  transfers: Transfer[];
  freeCash: number; // sell proceeds not absorbed by any buy
  needCash: number; // buys not covered by sell proceeds
}

const EPS = 0.005; // sub-cent slivers aren't worth a line

/** Two-pointer greedy match of sell proceeds into buys, newest source first. */
export function matchTrades(sells: TradeLeg[], buys: TradeLeg[]): RebalancePlan {
  const s = sells.map((x) => ({ name: x.name, left: x.amount }));
  const b = buys.map((x) => ({ name: x.name, left: x.amount }));
  const transfers: Transfer[] = [];
  let i = 0;
  let j = 0;
  while (i < s.length && j < b.length) {
    const amt = Math.min(s[i].left, b[j].left);
    if (amt > EPS) transfers.push({ from: s[i].name, to: b[j].name, amount: amt });
    s[i].left -= amt;
    b[j].left -= amt;
    if (s[i].left <= EPS) i++;
    if (b[j].left <= EPS) j++;
  }
  const freeCash = s.reduce((sum, x) => sum + Math.max(0, x.left), 0);
  const needCash = b.reduce((sum, x) => sum + Math.max(0, x.left), 0);
  return { transfers, freeCash, needCash };
}
