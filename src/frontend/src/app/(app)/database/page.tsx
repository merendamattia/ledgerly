"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Search } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/data-table";
import { useTables, useTableData } from "@/hooks/use-database";
import { truncate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { AdminGuard } from "@/components/admin-guard";

const PAGE = 50;
type Row = Record<string, unknown>;

/** Renders the read-only database browser for inspecting app tables. */
export default function DatabasePage() {
  const t = useTranslations("databasePage");
  const tables = useTables();
  const [table, setTable] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [limit, setLimit] = useState(PAGE);
  const debounce = useRef<ReturnType<typeof setTimeout>>(undefined);

  const tableList = useMemo(() => tables.data?.tables ?? [], [tables.data?.tables]);
  const active = table || tableList[0] || "";

  const data = useTableData(active, {
    search: search.trim() || undefined,
    limit,
    offset: 0,
  });

  /** Switches the active database table and resets filters/pagination. */
  function pickTable(value: string) {
    setTable(value);
    setSearchInput("");
    setSearch("");
    setLimit(PAGE);
  }

  /** Debounces the table search term before querying row data. */
  function onSearch(value: string) {
    setSearchInput(value);
    clearTimeout(debounce.current);
    debounce.current = setTimeout(() => {
      setSearch(value);
      setLimit(PAGE);
    }, 300);
  }

  useEffect(() => {
    return () => clearTimeout(debounce.current);
  }, []);

  const columns: Column<Row>[] = useMemo(
    () =>
      (data.data?.columns ?? []).map((col) => ({
        header: col.name,
        className: "whitespace-nowrap",
        cell: (row: Row) => {
          const value = row[col.name];
          const text =
            value === null || value === undefined
              ? "—"
              : typeof value === "object"
                ? JSON.stringify(value)
                : String(value);
          return (
            <span title={text} className="font-mono text-xs">
              {truncate(text, 48)}
            </span>
          );
        },
      })),
    [data.data?.columns],
  );

  const rows = (data.data?.rows ?? []) as Row[];
  const total = data.data?.total ?? 0;
  const hasMore = rows.length < total;

  return (
    <AdminGuard>
      <div className="flex flex-col gap-6">
        <PageHeader title={t("title")} description={t("description")} />

        <Card>
          <CardContent className="flex flex-col gap-0 p-0 md:flex-row">
            <nav className="flex shrink-0 gap-1 overflow-x-auto border-b p-2 md:max-h-[70vh] md:w-56 md:flex-col md:overflow-x-visible md:overflow-y-auto md:border-r md:border-b-0">
              {tableList.map((t) => (
                <Button
                  key={t}
                  variant="ghost"
                  size="sm"
                  aria-current={t === active ? "true" : undefined}
                  onClick={() => pickTable(t)}
                  className={cn(
                    "shrink-0 justify-start font-mono text-xs md:w-full",
                    t === active && "bg-accent text-accent-foreground",
                  )}
                >
                  {t}
                </Button>
              ))}
            </nav>

            <div className="flex min-w-0 flex-1 flex-col gap-4 p-4">
              <div className="relative w-full max-w-xs">
                <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchInput}
                  onChange={(e) => onSearch(e.target.value)}
                  placeholder={t("searchPlaceholder")}
                  className="pl-9"
                />
              </div>

              <div className="overflow-x-auto">
                <DataTable
                  columns={columns}
                  data={rows}
                  getRowKey={(r) => String(r.id ?? JSON.stringify(r))}
                  isLoading={data.isLoading}
                  emptyState={
                    <span className="text-sm text-muted-foreground">
                      {search ? t("noMatches") : t("empty")}
                    </span>
                  }
                />
              </div>

              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="tabular-nums">
                  {t("showing", { shown: rows.length, total })}
                </span>
                {hasMore && (
                  <Button variant="outline" size="sm" onClick={() => setLimit((l) => l + PAGE)}>
                    {t("loadMore")}
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminGuard>
  );
}
