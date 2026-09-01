"use client";

import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { Coins, Layers3, Pencil, Trash2, WalletCards } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { MoneyAmount } from "@/components/money-amount";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { AddAccountDialog } from "@/components/add-account-dialog";
import {
  ACCOUNT_BALANCE_ROW_CLASS,
  ACCOUNT_TILE_CLASS,
  ACCOUNT_TYPE_BADGE_CLASS,
} from "@/components/mobile-account-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAccounts, useDeleteAccount, type Account } from "@/hooks/use-accounts";
import { useLocaleLabels } from "@/hooks/use-locale-labels";
import { cn } from "@/lib/utils";

const SECTION_ORDER = ["LIQUIDITY", "CREDIT", "OTHER_ASSET"];

function RegistryStat({
  label,
  value,
  icon: Icon,
  spotlight = false,
  className,
}: {
  label: string;
  value: number;
  icon: typeof WalletCards;
  spotlight?: boolean;
  className?: string;
}) {
  return (
    <Card
      className={cn(
        "flex min-w-0 flex-row items-center gap-3 p-4 sm:p-5",
        spotlight && "border-0 bg-sidebar text-sidebar-accent-foreground",
        className,
      )}
    >
      <span
        className={cn(
          "flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary",
          spotlight && "bg-primary text-primary-foreground",
        )}
      >
        <Icon />
      </span>
      <span className="min-w-0">
        <span className="block font-mono text-xl font-semibold tabular-nums sm:text-2xl">{value}</span>
        <span
          className={cn(
            "block text-[11px] font-medium tracking-wide text-muted-foreground uppercase sm:text-xs",
            spotlight && "text-sidebar-foreground",
          )}
        >
          {label}
        </span>
      </span>
    </Card>
  );
}

const SECTION_STYLE: Record<string, { icon: typeof WalletCards; surface: string; ink: string }> = {
  LIQUIDITY: { icon: WalletCards, surface: "bg-positive/10", ink: "text-positive" },
  CREDIT: { icon: Coins, surface: "bg-chart-3/10", ink: "text-chart-3" },
  OTHER_ASSET: { icon: Layers3, surface: "bg-chart-4/10", ink: "text-chart-4" },
};

function AccountTile({ account, onDelete }: { account: Account; onDelete: () => void }) {
  const t = useTranslations("accountsPage");
  const common = useTranslations("common");
  const { cashCategories } = useLocaleLabels();
  const style = SECTION_STYLE[account.category] ?? SECTION_STYLE.LIQUIDITY;
  return (
    <article className={ACCOUNT_TILE_CLASS}>
      <div className="flex min-w-0 items-start gap-3">
        <span
          className={cn(
            "flex size-10 shrink-0 items-center justify-center rounded-xl font-display text-sm font-semibold",
            style.surface,
            style.ink,
          )}
        >
          {account.name.slice(0, 2).toUpperCase()}
        </span>
        <span className="min-w-0 flex-1 pt-0.5">
          <span className="block truncate text-sm font-semibold">{account.name}</span>
          <span className="mt-0.5 block truncate text-xs text-muted-foreground" title={account.note ?? undefined}>
            {account.note || account.type.replaceAll("_", " ")}
          </span>
        </span>
        <div className="-mr-1 -mt-1 flex shrink-0">
          <AddAccountDialog
            account={account}
            trigger={
              <Button variant="ghost" size="icon-sm" aria-label={t("edit", { name: account.name })}>
                <Pencil />
              </Button>
            }
          />
          <ConfirmDialog
            title={t("deleteTitle")}
            description={t("deleteDescription", { name: account.name })}
            confirmLabel={common("delete")}
            onConfirm={onDelete}
            trigger={
              <Button variant="ghost" size="icon-sm" aria-label={t("delete", { name: account.name })}>
                <Trash2 />
              </Button>
            }
          />
        </div>
      </div>

      <div className={ACCOUNT_BALANCE_ROW_CLASS}>
        <span className={ACCOUNT_TYPE_BADGE_CLASS}>
          {cashCategories[account.category]} · {account.currency}
        </span>
        <span className="min-w-0 max-w-full justify-self-end text-right">
          <span className="block text-[10px] text-muted-foreground">{t("currentBalance")}</span>
          <MoneyAmount
            value={account.balance}
            currency={account.currency}
            className="font-mono text-base font-semibold tabular-nums"
          />
        </span>
      </div>
    </article>
  );
}

/** Renders the account list and account-management actions. */
export default function AccountsPage() {
  const t = useTranslations("accountsPage");
  const { cashCategories } = useLocaleLabels();
  const { data, isLoading } = useAccounts();
  const del = useDeleteAccount();
  const accounts = data ?? [];
  const sections = SECTION_ORDER.map((category) => ({
    category,
    items: accounts
      .filter((account) => account.category === category)
      .sort((a, b) => a.name.localeCompare(b.name)),
  })).filter((section) => section.items.length > 0);

  return (
    <div className="flex flex-col gap-5 animate-fu">
      <PageHeader
        title={t("title")}
        description={t("description")}
        action={<AddAccountDialog />}
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:gap-4">
        <RegistryStat
          label={t("accounts")}
          value={accounts.length}
          icon={WalletCards}
          spotlight
          className="col-span-2 sm:col-span-1"
        />
        <RegistryStat label={t("sections")} value={new Set(accounts.map((account) => account.category)).size} icon={Layers3} />
        <RegistryStat label={t("currencies")} value={new Set(accounts.map((account) => account.currency)).size} icon={Coins} />
      </div>

      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 className="font-display text-lg font-semibold">{t("registry")}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{t("registryDescription")}</p>
        </div>
        <span className="hidden rounded-full border bg-card px-3 py-1 font-mono text-xs font-semibold text-muted-foreground sm:inline-flex">
          {t("total", { count: accounts.length })}
        </span>
      </div>

      {isLoading ? (
        <Card className="p-5">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-36 w-full rounded-2xl" />
              ))}
          </div>
        </Card>
      ) : sections.length === 0 ? (
        <Card>
            <div className="flex min-h-56 flex-col items-center justify-center gap-4 px-5 text-center">
              <span className="flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <WalletCards />
              </span>
              <div>
                <p className="font-display font-semibold">{t("emptyTitle")}</p>
                <p className="mt-1 text-sm text-muted-foreground">{t("emptyDescription")}</p>
              </div>
              <AddAccountDialog />
            </div>
        </Card>
      ) : (
        sections.map((section) => {
          const style = SECTION_STYLE[section.category] ?? SECTION_STYLE.LIQUIDITY;
          const SectionIcon = style.icon;
          return (
            <Card key={section.category} className="gap-0 overflow-hidden p-0">
              <CardHeader className="flex flex-row items-center justify-between gap-3 border-b px-4 py-4 sm:px-5">
                <div className="flex min-w-0 items-center gap-3">
                  <span className={cn("flex size-9 items-center justify-center rounded-xl", style.surface, style.ink)}>
                    <SectionIcon />
                  </span>
                  <div>
                    <CardTitle>{cashCategories[section.category as keyof typeof cashCategories]}</CardTitle>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {t("count", { count: section.items.length })}
                    </p>
                  </div>
                </div>
                <span className="rounded-full bg-muted px-2.5 py-1 font-mono text-xs font-semibold text-muted-foreground">
                  {section.items.length}
                </span>
              </CardHeader>
              <CardContent className="grid gap-3 p-3 sm:grid-cols-2 sm:p-4 xl:grid-cols-3">
                {section.items.map((account) => (
                  <AccountTile
                    key={account.id}
                    account={account}
                    onDelete={() =>
                      del.mutate(account.id, {
                        onSuccess: () => toast.success(t("deleted")),
                        onError: (error) => toast.error(error.message),
                      })
                    }
                  />
                ))}
              </CardContent>
            </Card>
          );
        })
      )}
    </div>
  );
}
