import { decode, detectDelimiter } from "./investment-csv.ts";

// Parser for bulk snapshot imports: a wide CSV/TSV where the first row is the
// header (`date,account1,account2,…`) and each subsequent row carries a date
// plus one balance per account column. The caller maps columns to accounts/debts
// (or asks to create them) before committing, so this stage just splits the grid.

export interface SnapshotCsvParse {
  /** Trimmed header cells, in column order. */
  headers: string[];
  /** Data rows (header excluded), each split into trimmed cells. */
  rows: string[][];
}

/** Split snapshot-import bytes into a header row plus the raw data grid. */
export function parseSnapshotCsv(bytes: Uint8Array | ArrayBuffer): SnapshotCsvParse {
  const text = decode(bytes);
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return { headers: [], rows: [] };

  const delimiter = detectDelimiter(lines[0]);
  const headers = lines[0].split(delimiter).map((c) => c.trim());
  const rows = lines.slice(1).map((l) => l.split(delimiter).map((c) => c.trim()));
  return { headers, rows };
}
