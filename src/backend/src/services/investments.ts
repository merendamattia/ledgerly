import type { InvestmentSide, InvestmentTransaction } from "@prisma/client";
import { investmentTransactionRepository } from "../repositories/investmentTransaction.ts";
import { holdingRepository } from "../repositories/holding.ts";
import { tickerRepository } from "../repositories/ticker.ts";
import { ensurePurchasePriceAnchor } from "./tickers.ts";
import { NotFoundError, ConflictError } from "../core/errors.ts";

export interface InvestmentTxInput {
  tickerId: string;
  cashAccountId: string;
  date: Date;
  side: InvestmentSide;
  quantity: number;
  price: number;
  fee?: number;
  note?: string | null;
}

// Edit payload: the ticker is fixed (driven by the position being edited).
export type InvestmentTxUpdate = Omit<InvestmentTxInput, "tickerId">;

/**
 * Derive a ticker's current position (quantity + weighted average cost) from its
 * full ordered list of buy/sell movements, then upsert/delete the Holding to match.
 * The avg cost is held flat across sells (realised P/L is not modelled here).
 */
export async function recomputeHolding(tickerId: string): Promise<void> {
  const txs = await investmentTransactionRepository.listByTicker(tickerId);

  // Anchor a manual/bond asset's price at its purchase date (no-op otherwise) so a back-dated
  // holding is valued from when it was bought rather than spiking on the day it was added.
  // Runs on every write path (record/update/delete/import) since they all recompute here.
  await ensurePurchasePriceAnchor(tickerId);

  let qty = 0;
  let costBasis = 0; // total cost of the currently-held shares, incl. fees
  for (const tx of txs) {
    const q = Number(tx.quantity);
    const price = Number(tx.price);
    const fee = Number(tx.fee);
    if (tx.side === "BUY") {
      qty += q;
      costBasis += q * price + fee;
    } else {
      const avg = qty > 0 ? costBasis / qty : 0;
      qty -= q;
      costBasis -= avg * q;
      if (qty <= 0) {
        qty = 0;
        costBasis = 0;
      }
    }
  }

  const existing = await holdingRepository.findByTicker(tickerId);

  if (qty <= 0) {
    if (existing) await holdingRepository.deleteByTicker(tickerId);
    return;
  }

  const avgCost = costBasis / qty;
  if (existing) {
    await holdingRepository.update(existing.id, { quantity: qty, avgCost });
  } else {
    await holdingRepository.create({
      quantity: qty,
      avgCost,
      ticker: { connect: { id: tickerId } },
    });
  }
}

/** Record a buy/sell movement and refresh the derived holding. */
export async function recordInvestmentTransaction(
  input: InvestmentTxInput,
): Promise<InvestmentTransaction> {
  const ticker = await tickerRepository.findById(input.tickerId);
  if (!ticker) throw new NotFoundError("Ticker not found");

  const tx = await investmentTransactionRepository.create({
    date: input.date,
    side: input.side,
    quantity: input.quantity,
    price: input.price,
    fee: input.fee ?? 0,
    note: input.note ?? null,
    ticker: { connect: { id: input.tickerId } },
    cashAccount: { connect: { id: input.cashAccountId } },
  });

  await recomputeHolding(input.tickerId);
  return tx;
}

/** Update a movement and refresh the derived holding (ticker is unchanged). */
export async function updateInvestmentTransaction(
  id: string,
  input: InvestmentTxUpdate,
): Promise<InvestmentTransaction> {
  const existing = await investmentTransactionRepository.findById(id);
  if (!existing) throw new NotFoundError("Investment transaction not found");

  const tx = await investmentTransactionRepository.update(id, {
    date: input.date,
    side: input.side,
    quantity: input.quantity,
    price: input.price,
    fee: input.fee ?? 0,
    note: input.note ?? null,
    cashAccount: { connect: { id: input.cashAccountId } },
  });

  await recomputeHolding(existing.tickerId);
  return tx;
}

/** Delete a movement and refresh the derived holding. */
export async function deleteInvestmentTransaction(id: string): Promise<void> {
  const existing = await investmentTransactionRepository.findById(id);
  if (!existing) throw new NotFoundError("Investment transaction not found");
  await investmentTransactionRepository.delete(id);
  await recomputeHolding(existing.tickerId);
}

/** Guard used before deleting a ticker that still has recorded movements. */
export async function assertNoInvestmentTransactions(tickerId: string): Promise<void> {
  const txs = await investmentTransactionRepository.listByTicker(tickerId);
  if (txs.length > 0) {
    throw new ConflictError("Cannot delete an asset that still has investment transactions");
  }
}
