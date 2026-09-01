"use client";

import { useState, type ReactElement } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCreateAccount, useUpdateAccount, type Account } from "@/hooks/use-accounts";
import { usePillars, useUpsertPillar } from "@/hooks/use-rebalance";
import { shortDate } from "@/lib/format";
import { useLocaleLabels } from "@/hooks/use-locale-labels";

const NO_PILLAR = "none";

export interface SnapshotNoteHistoryItem {
  date: string;
  note: string;
}

/**
 * Renders the create/edit dialog for cash, bank, credit, and other-asset accounts.
 */
export function AddAccountDialog({
  trigger,
  account,
  category = "LIQUIDITY",
  labels,
  noteHistory = [],
}: {
  trigger?: ReactElement;
  account?: Account;
  category?: Account["category"];
  labels?: { title?: string; description?: string };
  noteHistory?: SnapshotNoteHistoryItem[];
}) {
  const t = useTranslations("accountDialog");
  const { cashCategories } = useLocaleLabels();
  const editing = account != null;
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(account?.name ?? "");
  const [section, setSection] = useState<Account["category"]>(account?.category ?? category);
  const [currency, setCurrency] = useState(account?.currency ?? "EUR");
  const [balance, setBalance] = useState(account ? String(account.balance) : "0");
  const [note, setNote] = useState(account?.note ?? "");
  const create = useCreateAccount();
  const update = useUpdateAccount();
  const pending = create.isPending || update.isPending;

  // Pillar assignment: which of the 4 pillars (if any) this account belongs to.
  const pillars = usePillars();
  const upsertPillar = useUpsertPillar();
  const currentPillar = account
    ? (pillars.data?.find((p) => p.members.some((m) => m.cashAccountId === account.id))
        ?.position ?? null)
    : null;
  const [pillar, setPillar] = useState<string>(currentPillar ? String(currentPillar) : NO_PILLAR);
  const pillarItems = {
    [NO_PILLAR]: t("noPillar"),
    ...Object.fromEntries(
      [1, 2, 3, 4].map((n) => [
        String(n),
        pillars.data?.find((p) => p.position === n)?.name ?? t("pillarNumber", { number: n }),
      ]),
    ),
  };

  /** Moves the account between pillars to match the dialog selection. */
  function syncPillar(accountId: string) {
    const desired = pillar === NO_PILLAR ? null : Number(pillar);
    if (desired === currentPillar) return;
    const opts = { onError: (err: Error) => toast.error(err.message) };
    if (currentPillar != null) {
      const old = pillars.data?.find((p) => p.position === currentPillar);
      if (old) {
        upsertPillar.mutate(
          {
            position: old.position,
            name: old.name,
            members: old.members
              .filter((m) => m.cashAccountId !== accountId)
              .map((m) =>
                m.cashAccountId
                  ? { cashAccountId: m.cashAccountId }
                  : { tickerId: m.tickerId ?? "" },
              ),
          },
          opts,
        );
      }
    }
    if (desired != null) {
      const target = pillars.data?.find((p) => p.position === desired);
      upsertPillar.mutate(
        {
          position: desired,
          name: target?.name ?? t("pillarNumber", { number: desired }),
          members: [
            ...(target?.members ?? []).map((m) =>
              m.cashAccountId ? { cashAccountId: m.cashAccountId } : { tickerId: m.tickerId ?? "" },
            ),
            { cashAccountId: accountId },
          ],
        },
        opts,
      );
    }
  }

  /** Resets dialog fields from the current account/default values when opened. */
  function resetFields() {
    setName(account?.name ?? "");
    setSection(account?.category ?? category);
    setCurrency(account?.currency ?? "EUR");
    setBalance(account ? String(account.balance) : "0");
    setNote(account?.note ?? "");
    setPillar(currentPillar ? String(currentPillar) : NO_PILLAR);
  }

  /** Opens/closes the dialog and refreshes stale draft values before editing. */
  function handleOpenChange(nextOpen: boolean) {
    if (nextOpen) resetFields();
    setOpen(nextOpen);
  }

  /** Creates or updates the account from the current dialog fields. */
  function submit(e: React.FormEvent) {
    e.preventDefault();
    // `section` drives the category; the backend renames `type` to match it, so
    // both create and edit send the chosen section (editing can reclassify).
    const payload = {
      name,
      category: section,
      currency,
      balance: Number(balance),
      note: note || null,
    };
    const opts = {
      onSuccess: (saved: Account) => {
        syncPillar(saved.id);
        toast.success(editing ? t("updated") : t("created"));
        setOpen(false);
        if (!editing) {
          setName("");
          setBalance("0");
          setNote("");
          setPillar(NO_PILLAR);
        }
      },
      onError: (err: Error) => toast.error(err.message),
    };
    if (editing) update.mutate({ id: account.id, ...payload }, opts);
    else create.mutate(payload, opts);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={
          trigger ?? (
            <Button>
              <Plus data-icon="inline-start" />
              {t("add")}
            </Button>
          )
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {editing ? t("editTitle") : (labels?.title ?? t("newTitle"))}
          </DialogTitle>
          <DialogDescription>
            {labels?.description ?? t("description")}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit}>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="name">{t("name")}</FieldLabel>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
            </Field>
            <Field>
              <FieldLabel htmlFor="section">{t("type")}</FieldLabel>
              <Select
                value={section}
                items={cashCategories}
                onValueChange={(v) => setSection((v ?? "LIQUIDITY") as Account["category"])}
              >
                <SelectTrigger id="section">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {(Object.keys(cashCategories) as Account["category"][]).map((k) => (
                      <SelectItem key={k} value={k}>{cashCategories[k]}</SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
              <FieldDescription>{t("typeHelp")}</FieldDescription>
            </Field>
            <Field>
              <FieldLabel htmlFor="pillar">{t("pillar")}</FieldLabel>
              <Select value={pillar} items={pillarItems} onValueChange={(v) => setPillar(v ?? NO_PILLAR)}>
                <SelectTrigger id="pillar">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {Object.entries(pillarItems).map(([value, label]) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
              <FieldDescription>
                {t("pillarHelp")}
              </FieldDescription>
            </Field>
            <Field>
              <FieldLabel htmlFor="currency">{t("currency")}</FieldLabel>
              <Input
                id="currency"
                value={currency}
                onChange={(e) => setCurrency(e.target.value.toUpperCase())}
                maxLength={3}
                required
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="balance">{t("balance")}</FieldLabel>
              <Input
                id="balance"
                type="number"
                step="0.01"
                value={balance}
                onChange={(e) => setBalance(e.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="account-note">{t("note")}</FieldLabel>
              <Textarea
                id="account-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={280}
                rows={3}
              />
            </Field>
            {editing ? (
              <Field>
                <FieldLabel>{t("noteHistory")}</FieldLabel>
                {noteHistory.length > 0 ? (
                  <div className="flex max-h-44 flex-col overflow-auto rounded-lg border">
                    {noteHistory.map((item) => (
                      <div
                        key={`${item.date}:${item.note}`}
                        className="flex flex-col gap-1 border-b px-3 py-2.5 last:border-b-0"
                      >
                        <span className="font-mono text-xs text-muted-foreground">
                          {shortDate(item.date)}
                        </span>
                        <span className="break-words text-sm">{item.note}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <FieldDescription>{t("noNoteHistory")}</FieldDescription>
                )}
              </Field>
            ) : null}
            <DialogFooter>
              <Button type="submit" disabled={pending}>
                {editing ? t("save") : t("create")}
              </Button>
            </DialogFooter>
          </FieldGroup>
        </form>
      </DialogContent>
    </Dialog>
  );
}
