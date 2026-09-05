"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Bot,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Eye,
  Hash,
  ListChecks,
} from "lucide-react";
import { AdminGuard } from "@/components/admin-guard";
import { DataTable, type Column } from "@/components/data-table";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { useUsers } from "@/hooks/use-users";
import {
  useWalletRequest,
  useWalletRequests,
  type WalletRequestDetail,
  type WalletRequestList,
} from "@/hooks/use-wallet-requests";
import { formatDateOnly, formatDateTime, formatNumber, truncate } from "@/lib/format";
import type { WalletRequestFilters, WalletRequestStatus } from "@/lib/query-keys";

const PAGE = 25;

type FilterState = Omit<WalletRequestFilters, "limit" | "offset">;
type WalletRequestRow = WalletRequestList["items"][number];

const statusTranslationKey: Record<WalletRequestStatus, "pending" | "queued" | "running" | "retrying" | "completed" | "failed"> = {
  PENDING: "pending",
  QUEUED: "queued",
  RUNNING: "running",
  RETRYING: "retrying",
  COMPLETED: "completed",
  FAILED: "failed",
};

/** Uses semantic badge tones for the request lifecycle. */
function statusVariant(status: WalletRequestStatus): "default" | "secondary" | "destructive" {
  if (status === "COMPLETED") return "default";
  if (status === "FAILED") return "destructive";
  return "secondary";
}

function prettyJson(value: unknown) {
  return JSON.stringify(value, null, 2) ?? "null";
}

function credentialHint(
  item: { integrationTokenPrefix: string | null; integrationTokenSuffix: string | null },
  missingLabel: string,
) {
  return item.integrationTokenPrefix && item.integrationTokenSuffix
    ? `${item.integrationTokenPrefix}…${item.integrationTokenSuffix}`
    : missingLabel;
}

/** Renders a compact label/value pair inside the request detail sheet. */
function DetailField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words text-sm">{children}</dd>
    </div>
  );
}

/** Renders the admin-only Wallet AI request history and telemetry surface. */
export default function WalletRequestsPage() {
  const t = useTranslations("walletRequestsPage");
  const users = useUsers();
  const [filters, setFilters] = useState<FilterState>({});
  const [offset, setOffset] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const requestFilters = useMemo<WalletRequestFilters>(
    () => ({ ...filters, limit: PAGE, offset }),
    [filters, offset],
  );
  const requests = useWalletRequests(requestFilters);
  const detail = useWalletRequest(selectedId ?? "", !!selectedId);

  const userItems = useMemo(() => {
    const items: Record<string, string> = { ALL: t("allUsers") };
    for (const user of users.data ?? []) {
      items[user.id] = user.name ? `${user.name} · ${user.email}` : user.email;
    }
    return items;
  }, [t, users.data]);

  const statusItems = useMemo(
    () => ({
      ALL: t("allStatuses"),
      PENDING: t("pending"),
      QUEUED: t("queued"),
      RUNNING: t("running"),
      RETRYING: t("retrying"),
      COMPLETED: t("completed"),
      FAILED: t("failed"),
    }),
    [t],
  );

  function changeFilter(key: keyof FilterState, value: string) {
    setFilters((current) => ({ ...current, [key]: value || undefined }));
    setOffset(0);
  }

  function clearFilters() {
    setFilters({});
    setOffset(0);
  }

  const rows = requests.data?.items ?? [];
  const total = requests.data?.total ?? 0;
  const hasPrevious = offset > 0;
  const hasNext = offset + rows.length < total;
  const summary = requests.data?.summary;
  const hasFilters = Object.values(filters).some(Boolean);

  const columns: Column<WalletRequestRow>[] = useMemo(
    () => [
      {
        header: t("id"),
        className: "whitespace-nowrap",
        cell: (row) => (
          <span className="font-mono text-xs" title={row.id}>
            {truncate(row.id, 14)}
          </span>
        ),
      },
      {
        header: t("received"),
        className: "whitespace-nowrap",
        cell: (row) => <span className="text-xs tabular-nums">{formatDateTime(row.createdAt)}</span>,
      },
      {
        header: t("user"),
        className: "min-w-44",
        cell: (row) => (
          <div className="flex min-w-0 flex-col">
            <span className="truncate font-medium">{row.user.name}</span>
            <span className="truncate text-xs text-muted-foreground">{row.user.email}</span>
          </div>
        ),
      },
      {
        header: t("status"),
        cell: (row) => (
          <Badge variant={statusVariant(row.status)}>{t(statusTranslationKey[row.status])}</Badge>
        ),
      },
      {
        header: t("model"),
        className: "max-w-44",
        cell: (row) => (
          <span className="block truncate font-mono text-xs" title={row.aiModel ?? undefined}>
            {row.aiModel ? truncate(row.aiModel, 24) : "—"}
          </span>
        ),
      },
      {
        header: t("tokens"),
        align: "right",
        className: "whitespace-nowrap",
        cell: (row) => (
          <span className="font-mono text-xs tabular-nums">
            {row.aiTotalTokens == null ? "—" : formatNumber(row.aiTotalTokens, 0)}
          </span>
        ),
      },
      {
        header: "",
        align: "right",
        className: "w-10",
        cell: (row) => (
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label={t("view")}
            title={t("view")}
            onClick={(event) => {
              event.stopPropagation();
              setSelectedId(row.id);
            }}
          >
            <Eye />
          </Button>
        ),
      },
    ],
    [t],
  );

  return (
    <AdminGuard>
      <div className="flex flex-col gap-6">
        <PageHeader title={t("title")} description={t("description")} />

        <Card>
          <CardHeader>
            <CardTitle>{t("filters")}</CardTitle>
          </CardHeader>
          <CardContent>
            <FieldGroup className="gap-4 lg:grid lg:grid-cols-[1.6fr_1fr_1fr_1fr_auto] lg:items-end">
              <Field>
                <FieldLabel htmlFor="wallet-request-user">{t("user")}</FieldLabel>
                <Select
                  value={filters.userId ?? "ALL"}
                  items={userItems}
                  onValueChange={(value) => changeFilter("userId", value === "ALL" ? "" : value ?? "")}
                >
                  <SelectTrigger id="wallet-request-user" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(userItems).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel htmlFor="wallet-request-status">{t("status")}</FieldLabel>
                <Select
                  value={filters.status ?? "ALL"}
                  items={statusItems}
                  onValueChange={(value) =>
                    changeFilter("status", value === "ALL" ? "" : value ?? "")
                  }
                >
                  <SelectTrigger id="wallet-request-status" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(statusItems).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel htmlFor="wallet-request-from">{t("from")}</FieldLabel>
                <Input
                  id="wallet-request-from"
                  type="date"
                  value={filters.from ?? ""}
                  onChange={(event) => changeFilter("from", event.target.value)}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="wallet-request-to">{t("to")}</FieldLabel>
                <Input
                  id="wallet-request-to"
                  type="date"
                  value={filters.to ?? ""}
                  onChange={(event) => changeFilter("to", event.target.value)}
                />
              </Field>
              <Button type="button" variant="outline" onClick={clearFilters} disabled={!hasFilters}>
                {t("clear")}
              </Button>
            </FieldGroup>
          </CardContent>
        </Card>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label={t("requestCount")} value={formatNumber(summary?.requestCount ?? 0, 0)} icon={ListChecks} />
          <StatCard label={t("inputTokens")} value={formatNumber(summary?.inputTokens ?? 0, 0)} icon={ArrowDownToLine} accent="positive" />
          <StatCard label={t("outputTokens")} value={formatNumber(summary?.outputTokens ?? 0, 0)} icon={ArrowUpFromLine} accent="negative" />
          <StatCard label={t("totalTokens")} value={formatNumber(summary?.totalTokens ?? 0, 0)} icon={Hash} accent="primary" />
        </div>

        {requests.isError ? (
          <Alert variant="destructive">
            <CircleAlert />
            <AlertTitle>{t("loadError")}</AlertTitle>
          </Alert>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle>{t("requests")}</CardTitle>
            <CardDescription>{t("showing", { shown: rows.length, total })}</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <DataTable
                columns={columns}
                data={rows}
                getRowKey={(row) => row.id}
                isLoading={requests.isLoading}
                onRowClick={(row) => setSelectedId(row.id)}
                emptyState={<span className="text-sm text-muted-foreground">{t("empty")}</span>}
              />
            </div>
            <div className="flex items-center justify-between border-t px-5 py-3 text-xs text-muted-foreground">
              <span className="tabular-nums">{t("showing", { shown: rows.length, total })}</span>
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  aria-label={t("previous")}
                  title={t("previous")}
                  disabled={!hasPrevious || requests.isFetching}
                  onClick={() => setOffset((current) => Math.max(0, current - PAGE))}
                >
                  <ChevronLeft />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  aria-label={t("next")}
                  title={t("next")}
                  disabled={!hasNext || requests.isFetching}
                  onClick={() => setOffset((current) => current + PAGE)}
                >
                  <ChevronRight />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Sheet open={!!selectedId} onOpenChange={(open) => !open && setSelectedId(null)}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-xl">
          <SheetHeader>
            <SheetTitle>{t("detailTitle")}</SheetTitle>
            <SheetDescription>{t("detailDescription")}</SheetDescription>
          </SheetHeader>
          <RequestDetail detail={detail.data} isLoading={detail.isLoading} isError={detail.isError} t={t} />
        </SheetContent>
      </Sheet>
    </AdminGuard>
  );
}

function RequestDetail({
  detail,
  isLoading,
  isError,
  t,
}: {
  detail: WalletRequestDetail | undefined;
  isLoading: boolean;
  isError: boolean;
  t: ReturnType<typeof useTranslations<"walletRequestsPage">>;
}) {
  if (isLoading) {
    return (
      <div className="flex flex-col gap-4 px-4 pb-6">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (isError || !detail) {
    return <p className="px-4 text-sm text-muted-foreground">{t("loadError")}</p>;
  }

  return (
    <div className="flex flex-col gap-5 px-4 pb-6">
      <dl className="grid gap-3 rounded-xl border bg-muted/20 p-3 sm:grid-cols-2">
        <DetailField label={t("requestId")}>
          <span className="font-mono text-xs">{detail.id}</span>
        </DetailField>
        <DetailField label={t("createdAt")}>{formatDateTime(detail.createdAt)}</DetailField>
        <DetailField label={t("userDetails")}>
          <span>{detail.user.name}</span>
          <span className="block text-xs text-muted-foreground">{detail.user.email}</span>
        </DetailField>
        <DetailField label={t("statusDetail")}>
          <Badge variant={statusVariant(detail.status)}>{t(statusTranslationKey[detail.status])}</Badge>
        </DetailField>
        <DetailField label={t("attempts")}>{detail.attempts}</DetailField>
        <DetailField label={t("modelUsed")}>
          <span className="font-mono text-xs">{detail.aiModel ?? "—"}</span>
        </DetailField>
        <DetailField label={t("credentialHint")}>
          <span className="font-mono text-xs">
            {credentialHint(detail, t("noCredentialHint"))}
          </span>
        </DetailField>
      </dl>

      <section className="flex flex-col gap-2">
        <h2 className="flex items-center gap-2 font-display text-sm font-semibold">
          <Bot className="size-4 text-primary" />
          {t("usage")}
        </h2>
        <div className="grid grid-cols-3 gap-2">
          {[
            [t("input"), detail.aiInputTokens],
            [t("output"), detail.aiOutputTokens],
            [t("total"), detail.aiTotalTokens],
          ].map(([label, value]) => (
            <div key={label} className="rounded-lg border bg-muted/20 p-2.5">
              <div className="text-xs text-muted-foreground">{label}</div>
              <div className="mt-1 font-mono text-sm font-semibold tabular-nums">
                {value == null ? "—" : formatNumber(Number(value), 0)}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-display text-sm font-semibold">{t("rawPayload")}</h2>
        <pre className="max-h-80 overflow-auto whitespace-pre-wrap break-words rounded-xl bg-muted p-3 font-mono text-xs leading-relaxed">
          {prettyJson(detail.rawPayload)}
        </pre>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-display text-sm font-semibold">{t("normalizedResult")}</h2>
        {detail.normalizedResult == null ? (
          <p className="text-sm text-muted-foreground">{t("noResult")}</p>
        ) : (
          <pre className="max-h-80 overflow-auto whitespace-pre-wrap break-words rounded-xl bg-muted p-3 font-mono text-xs leading-relaxed">
            {prettyJson(detail.normalizedResult)}
          </pre>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-display text-sm font-semibold">{t("transaction")}</h2>
        {detail.transaction ? (
          <Card size="sm">
            <CardContent className="p-3">
              <dl className="grid gap-2 sm:grid-cols-2">
                <DetailField label={t("transactionId")}>
                  <span className="font-mono text-xs">{detail.transaction.id}</span>
                </DetailField>
                <DetailField label={t("transactionDate")}>
                  {formatDateOnly(detail.transaction.date)}
                </DetailField>
                <DetailField label={t("transactionAmount")}>
                  {formatNumber(Number(detail.transaction.amount))}
                </DetailField>
                <DetailField label={t("transactionDirection")}>
                  {detail.transaction.direction === "INCOME" ? t("income") : t("expense")}
                </DetailField>
                <DetailField label={t("transactionNote")}>{detail.transaction.note || "—"}</DetailField>
                <DetailField label={t("transactionCategory")}>
                  {detail.transaction.category?.name ?? "—"}
                </DetailField>
                <DetailField label={t("reviewStatus")}>
                  <Badge variant={detail.transaction.reviewRequired ? "secondary" : "default"}>
                    {detail.transaction.reviewRequired ? t("reviewRequired") : t("reviewed")}
                  </Badge>
                </DetailField>
              </dl>
            </CardContent>
          </Card>
        ) : (
          <p className="text-sm text-muted-foreground">{t("noTransaction")}</p>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-display text-sm font-semibold">{t("error")}</h2>
        {detail.lastError ? (
          <Alert variant="destructive">
            <CircleAlert />
            <AlertDescription className="font-mono text-xs">{detail.lastError}</AlertDescription>
          </Alert>
        ) : (
          <p className="text-sm text-muted-foreground">{t("noError")}</p>
        )}
      </section>
    </div>
  );
}
