import { parse as parseDate, isValid, format } from "date-fns";

// Parser for the export file produced by the Budjet app. The file is UTF-16LE,
// TAB-delimited, with every field wrapped in double quotes. Columns:
//   Type | Category | Date | Transaction | Note
// Quirks handled here:
//  - "Type" is "Expenses" / "Income" -> EXPENSE / INCOME.
//  - "Date" looks like "14 Jun 2026" (English month abbreviation).
//  - "Transaction" amounts use a U+2212 minus for expenses, a NBSP before the
//    euro sign, a decimal comma and a thousands dot, e.g. "−5,99 €", "2.029 €".
//  - Notes may contain embedded newlines inside the quotes, so the records must
//    be split with a quote-aware parser rather than by splitting on newlines.

export interface ParsedRow {
  direction: "INCOME" | "EXPENSE";
  category: string | null;
  /** ISO calendar date, `yyyy-MM-dd`. */
  date: string;
  amount: number;
  note: string | null;
}

export interface ParseError {
  /** 1-based line where the offending record starts. */
  line: number;
  raw: string;
  message: string;
}

export interface ParseResult {
  rows: ParsedRow[];
  errors: ParseError[];
}

/** A record plus the 1-based line where it started (for error reporting). */
interface RawRecord {
  fields: string[];
  line: number;
}

/** Decode raw file bytes (UTF-16LE) and strip a leading BOM if present. */
function decode(bytes: Uint8Array | ArrayBuffer): string {
  const decoder = new TextDecoder("utf-16le" as ConstructorParameters<typeof TextDecoder>[0]);
  const text = decoder.decode(bytes);
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

/**
 * Quote-aware TSV split. Honours `"` quoting (with `""` as an escaped quote) so
 * tabs and newlines inside a quoted field do not split the record.
 */
function splitRecords(text: string): RawRecord[] {
  const records: RawRecord[] = [];
  let fields: string[] = [];
  let field = "";
  let inQuotes = false;
  let line = 1;
  let recordStartLine = 1;
  let recordHasContent = false;

  const pushField = () => {
    fields.push(field);
    field = "";
  };
  const pushRecord = () => {
    pushField();
    records.push({ fields, line: recordStartLine });
    fields = [];
    recordHasContent = false;
  };

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (!recordHasContent && !inQuotes) recordStartLine = line;

    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        if (ch === "\n") line++;
        field += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
      recordHasContent = true;
    } else if (ch === "\t") {
      pushField();
      recordHasContent = true;
    } else if (ch === "\r") {
      // ignore; handled by the following \n
    } else if (ch === "\n") {
      line++;
      if (recordHasContent || fields.length > 0 || field.length > 0) pushRecord();
    } else {
      field += ch;
      recordHasContent = true;
    }
  }
  if (recordHasContent || fields.length > 0 || field.length > 0) pushRecord();
  return records;
}

/** Convert a Budjet amount string ("−5,99 €", "2.029 €") to a positive number. */
function parseAmount(raw: string): number {
  // Drop everything except digits, decimal comma and dot (this also removes the
  // U+2212 minus, NBSP, spaces and the euro sign), then comma -> decimal point
  // and dots -> thousands separators removed.
  const cleaned = raw
    .replace(/[^0-9.,]/g, "")
    .replace(/\./g, "")
    .replace(",", ".");
  return Math.abs(Number(cleaned));
}

/**
 * Parses a Budjet UTF-16LE export into normalized transaction rows and errors.
 */
export function parseBudjetExport(bytes: Uint8Array | ArrayBuffer): ParseResult {
  const records = splitRecords(decode(bytes));
  const rows: ParsedRow[] = [];
  const errors: ParseError[] = [];

  for (const { fields, line } of records) {
    const cells = fields.map((f) => f.trim());
    // Skip the header row.
    if (cells[0]?.toLowerCase() === "type") continue;
    // Skip fully empty trailing records.
    if (cells.every((c) => c === "")) continue;

    const raw = cells.join("\t");
    const [type, category, dateStr, amountStr, note] = cells;

    const direction =
      type?.toLowerCase() === "expenses"
        ? "EXPENSE"
        : type?.toLowerCase() === "income"
          ? "INCOME"
          : null;
    if (!direction) {
      errors.push({ line, raw, message: `Unknown type "${type ?? ""}"` });
      continue;
    }

    const parsed = parseDate(dateStr ?? "", "d MMM yyyy", new Date());
    if (!isValid(parsed)) {
      errors.push({ line, raw, message: `Invalid date "${dateStr ?? ""}"` });
      continue;
    }

    const amount = parseAmount(amountStr ?? "");
    if (!Number.isFinite(amount) || amount <= 0) {
      errors.push({ line, raw, message: `Invalid amount "${amountStr ?? ""}"` });
      continue;
    }

    rows.push({
      direction,
      category: category ? category.toLowerCase() : null,
      date: format(parsed, "yyyy-MM-dd"),
      amount,
      note: note && note.length > 0 ? note : null,
    });
  }

  return { rows, errors };
}
