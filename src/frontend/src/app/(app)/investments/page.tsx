"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { MoneyAmount } from "@/components/money-amount";
import { DataTable, type Column } from "@/components/data-table";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useTickers,
  useAddAsset,
  useDeleteTicker,
  useCreateHolding,
  useDeleteHolding,
  type Ticker,
} from "@/hooks/use-investments";
import { useDashboard, type DashboardData } from "@/hooks/use-dashboard";
import { formatNumber, formatPercent } from "@/lib/format";

type HoldingValuation = DashboardData["netWorth"]["holdings"][number];

function AddAssetDialog() {
  const [open, setOpen] = useState(false);
  const [symbol, setSymbol] = useState("");
  const [type, setType] = useState<"EQUITY" | "ETF" | "CRYPTO">("ETF");
  const add = useAddAsset();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    add.mutate(
      { symbol, type },
      {
        onSuccess: () => {
          toast.success("Asset added — history is downloading in the background");
          setOpen(false);
          setSymbol("");
        },
        onError: (err) => toast.error(err.message),
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button />}>
        <Plus data-icon="inline-start" />
        Add asset
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Track a new asset</DialogTitle>
          <DialogDescription>
            Enter a ticker (e.g. CSSPX.MI, AAPL) or a crypto symbol (e.g. BTC). The full price
            history is downloaded automatically.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit}>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="symbol">Symbol</FieldLabel>
              <Input
                id="symbol"
                value={symbol}
                onChange={(e) => setSymbol(e.target.value)}
                required
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="type">Type</FieldLabel>
              <Select value={type} onValueChange={(v) => setType((v ?? "ETF") as typeof type)}>
                <SelectTrigger id="type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ETF">ETF</SelectItem>
                  <SelectItem value="EQUITY">Equity</SelectItem>
                  <SelectItem value="CRYPTO">Crypto</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <DialogFooter>
              <Button type="submit" disabled={add.isPending}>
                Add
              </Button>
            </DialogFooter>
          </FieldGroup>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function AddHoldingDialog({ tickers }: { tickers: Ticker[] }) {
  const [open, setOpen] = useState(false);
  const [tickerId, setTickerId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [avgCost, setAvgCost] = useState("");
  const create = useCreateHolding();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    create.mutate(
      { tickerId, quantity: Number(quantity), avgCost: Number(avgCost) },
      {
        onSuccess: () => {
          toast.success("Holding added");
          setOpen(false);
          setQuantity("");
          setAvgCost("");
        },
        onError: (err) => toast.error(err.message),
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" disabled={tickers.length === 0} />}>
        <Plus data-icon="inline-start" />
        Add holding
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New holding</DialogTitle>
          <DialogDescription>Record a position for a tracked asset.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit}>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="ticker">Asset</FieldLabel>
              <Select value={tickerId} onValueChange={(v) => setTickerId(v ?? "")}>
                <SelectTrigger id="ticker">
                  <SelectValue placeholder="Select an asset" />
                </SelectTrigger>
                <SelectContent>
                  {tickers.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.symbol} — {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel htmlFor="quantity">Quantity</FieldLabel>
              <Input
                id="quantity"
                type="number"
                step="any"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                required
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="avgCost">Average cost (per unit)</FieldLabel>
              <Input
                id="avgCost"
                type="number"
                step="any"
                value={avgCost}
                onChange={(e) => setAvgCost(e.target.value)}
                required
              />
            </Field>
            <DialogFooter>
              <Button type="submit" disabled={create.isPending || !tickerId}>
                Create
              </Button>
            </DialogFooter>
          </FieldGroup>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function InvestmentsPage() {
  const tickers = useTickers();
  const dashboard = useDashboard();
  const delTicker = useDeleteTicker();
  const delHolding = useDeleteHolding();

  const currency = dashboard.data?.netWorth.baseCurrency ?? "EUR";
  const holdings = dashboard.data?.netWorth.holdings ?? [];

  const holdingColumns: Column<HoldingValuation>[] = [
    { header: "Asset", cell: (h) => <span className="font-medium">{h.symbol}</span> },
    {
      header: "Qty",
      align: "right",
      cell: (h) => formatNumber(h.quantity, 4),
    },
    {
      header: "Price",
      align: "right",
      cell: (h) => <MoneyAmount value={h.price} currency={h.currency} />,
    },
    {
      header: "Value",
      align: "right",
      cell: (h) => <MoneyAmount value={h.value} currency={currency} />,
    },
    {
      header: "Gain",
      align: "right",
      cell: (h) => (
        <Badge variant={h.gain >= 0 ? "default" : "destructive"}>{formatPercent(h.gainPct)}</Badge>
      ),
    },
    {
      header: "",
      align: "right",
      cell: (h) => (
        <ConfirmDialog
          title="Delete holding?"
          confirmLabel="Delete"
          onConfirm={() =>
            delHolding.mutate(h.holdingId, {
              onSuccess: () => toast.success("Holding deleted"),
              onError: (e) => toast.error(e.message),
            })
          }
          trigger={
            <Button variant="ghost" size="icon">
              <Trash2 />
            </Button>
          }
        />
      ),
    },
  ];

  const assetColumns: Column<Ticker>[] = [
    { header: "Symbol", cell: (t) => <span className="font-medium">{t.symbol}</span> },
    { header: "Name", cell: (t) => t.name },
    { header: "Type", cell: (t) => <Badge variant="secondary">{t.type}</Badge> },
    { header: "Currency", cell: (t) => t.currency },
    { header: "Prices", align: "right", cell: (t) => formatNumber(t.priceCount, 0) },
    {
      header: "",
      align: "right",
      cell: (t) => (
        <ConfirmDialog
          title="Stop tracking asset?"
          description={`This removes "${t.symbol}" and its price history.`}
          confirmLabel="Delete"
          onConfirm={() =>
            delTicker.mutate(t.id, {
              onSuccess: () => toast.success("Asset removed"),
              onError: (e) => toast.error(e.message),
            })
          }
          trigger={
            <Button variant="ghost" size="icon">
              <Trash2 />
            </Button>
          }
        />
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Investments"
        description="Your portfolio and tracked assets."
        action={
          <div className="flex gap-2">
            <AddHoldingDialog tickers={tickers.data ?? []} />
            <AddAssetDialog />
          </div>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>Holdings</CardTitle>
          <CardDescription>Positions valued at the latest close, in {currency}.</CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={holdingColumns}
            data={holdings}
            getRowKey={(h) => h.holdingId}
            isLoading={dashboard.isLoading}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Tracked assets</CardTitle>
          <CardDescription>Instruments with stored daily price history.</CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={assetColumns}
            data={tickers.data}
            getRowKey={(t) => t.id}
            isLoading={tickers.isLoading}
          />
        </CardContent>
      </Card>
    </div>
  );
}
