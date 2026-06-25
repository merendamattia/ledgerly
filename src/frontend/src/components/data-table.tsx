import type { ReactNode } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export interface Column<T> {
  header: string;
  cell: (row: T) => ReactNode;
  className?: string;
  align?: "left" | "right" | "center";
}

const alignClass = {
  left: "text-left",
  right: "text-right",
  center: "text-center",
} as const;

/**
 * Renders the generic reusable table used by accounts, holdings, transactions,
 * and cron runs.
 */
export function DataTable<T>({
  columns,
  data,
  getRowKey,
  isLoading,
  emptyState,
  onRowClick,
}: {
  columns: Column<T>[];
  data: T[] | undefined;
  getRowKey: (row: T) => string;
  isLoading?: boolean;
  emptyState?: ReactNode;
  onRowClick?: (row: T) => void;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          {columns.map((col, i) => (
            <TableHead key={i} className={cn(col.align && alignClass[col.align], col.className)}>
              {col.header}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {isLoading ? (
          Array.from({ length: 4 }).map((_, r) => (
            <TableRow key={r}>
              {columns.map((_, c) => (
                <TableCell key={c}>
                  <Skeleton className="h-5 w-full" />
                </TableCell>
              ))}
            </TableRow>
          ))
        ) : !data || data.length === 0 ? (
          <TableRow>
            <TableCell colSpan={columns.length} className="h-32 text-center">
              {emptyState ?? (
                <span className="text-sm text-muted-foreground">No data yet.</span>
              )}
            </TableCell>
          </TableRow>
        ) : (
          data.map((row) => (
            <TableRow
              key={getRowKey(row)}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              className={cn(onRowClick && "cursor-pointer")}
            >
              {columns.map((col, i) => (
                <TableCell key={i} className={cn(col.align && alignClass[col.align], col.className)}>
                  {col.cell(row)}
                </TableCell>
              ))}
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );
}
