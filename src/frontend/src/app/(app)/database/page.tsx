"use client";

import { useMemo, useRef, useState } from "react";
import { Search } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DataTable, type Column } from "@/components/data-table";
import { useTables, useTableData } from "@/hooks/use-database";
import { truncate } from "@/lib/format";

const PAGE = 50;
type Row = Record<string, unknown>;

export default function DatabasePage() {
  const tables = useTables();
  const [table, setTable] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [limit, setLimit] = useState(PAGE);
  const debounce = useRef<ReturnType<typeof setTimeout>>(undefined);

  const tableList = useMemo(() => tables.data?.tables ?? [], [tables.data?.tables]);
  const active = table || tableList[0] || "";
  const tableItems = useMemo(
    () => Object.fromEntries(tableList.map((t) => [t, t])),
    [tableList],
  );

  const data = useTableData(active, {
    search: search.trim() || undefined,
    limit,
    offset: 0,
  });

  function pickTable(value: string) {
    setTable(value);
    setSearchInput("");
    setSearch("");
    setLimit(PAGE);
  }

  function onSearch(value: string) {
    setSearchInput(value);
    clearTimeout(debounce.current);
    debounce.current = setTimeout(() => {
      setSearch(value);
      setLimit(PAGE);
    }, 300);
  }

  const columns: Column<Row>[] = useMemo(
    () =>
      (data.data?.columns ?? []).map((col) => ({
        header: col.name,
        className: "whitespace-nowrap",
        cell: (row: Row) => {
          const value = row[col.name];
          const text = value === null || value === undefined ? "—" : String(value);
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
    <div className="flex flex-col gap-6">
      <PageHeader title="Database" description="Read-only browser for every table in the database." />

      <Card>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Select value={active} items={tableItems} onValueChange={(v) => pickTable(v ?? "")}>
              <SelectTrigger className="w-[240px]">
                <SelectValue placeholder="Select a table" />
              </SelectTrigger>
              <SelectContent>
                {tableList.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="relative w-full max-w-xs">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchInput}
                onChange={(e) => onSearch(e.target.value)}
                placeholder="Search this table…"
                className="pl-9"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <DataTable
              columns={columns}
              data={rows}
              getRowKey={(r) => String(r.id ?? JSON.stringify(r))}
              isLoading={data.isLoading}
              emptyState={
                <span className="text-sm text-muted-foreground">
                  {search ? "No rows match your search." : "This table is empty."}
                </span>
              }
            />
          </div>

          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="tabular-nums">
              Showing {rows.length} of {total} row{total === 1 ? "" : "s"}
            </span>
            {hasMore && (
              <Button variant="outline" size="sm" onClick={() => setLimit((l) => l + PAGE)}>
                Load more
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
