import { parse as parseDate, parseISO, isValid, format } from "date-fns";
import { investmentImportColumnMapSchema } from "../schemas/index.ts";

// Parser for broker investment-transaction exports (Trading212-style). The file
// is locale-formatted (Italian) with the columns:
//   TICKET | PREZZO (€) | QUANTITÀ (#) | QUANTITÀ (€) | DATA | BROKER
// e.g. "AMS:CSPX  € 458,35  1,390  € 637,20  15/01/2024  Trading212".
// Quirks handled here:
//  - The delimiter varies (TAB, ";", ",", or runs of 2+ spaces); it is auto-detected.
//  - Amounts carry a euro sign, a NBSP/space, a decimal comma and a thousands dot
//    ("€ 458,35", "2.029 €"); quantities use a decimal comma ("1,390" = 1.39).
//  - Dates are "dd/MM/yyyy".
//  - The ticker symbol ("AMS:CSPX") and broker ("Trading212") are raw strings that
//    the caller maps to real Ticker / CashAccount records before committing.

export interface ParsedInvestmentRow {
  /** Raw symbol as written in the file (mapped to a Ticker downstream). */
  ticker: string;
  /** Raw broker label as written in the file (mapped to a CashAccount downstream). */
  broker: string;
  /** ISO calendar date, `yyyy-MM-dd`. */
  date: string;
  quantity: number;
  price: number;
  /** QUANTITÀ (€) — total cost, kept for preview/validation only (not persisted). */
  total: number | null;
}

export interface ParseError {
  /** 1-based line of the offending record. */
  line: number;
  raw: string;
  message: string;
}

export interface ParseResult {
  rows: ParsedInvestmentRow[];
  errors: ParseError[];
}

export type InvestmentImportColumnMap = {
  ticker: number | null;
  price: number | null;
  quantity: number | null;
  total: number | null;
  date: number | null;
  broker: number | null;
  defaults: {
    ticker?: string;
    date?: string;
    broker?: string;
  };
  skipHeader: boolean;
};

const legacyColumnMap: InvestmentImportColumnMap = {
  ticker: 0,
  price: 1,
  quantity: 2,
  total: 3,
  date: 4,
  broker: 5,
  defaults: {},
  skipHeader: true,
};

/** Decode raw bytes as UTF-8 and strip a leading BOM if present. */
export function decode(bytes: Uint8Array | ArrayBuffer): string {
  const text = new TextDecoder("utf-8").decode(bytes);
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

/** Pick the field delimiter from the header line. */
export function detectDelimiter(headerLine: string): RegExp {
  if (headerLine.includes("\t")) return /\t/;
  if (headerLine.includes(";")) return /;/;
  if (headerLine.includes(",")) return /,/;
  // Fall back to runs of 2+ whitespace: a single space inside "€ 458,35" is kept.
  return /\s{2,}/;
}

/**
 * Convert a locale amount ("€ 458,35", "2.029 €", "1,390") to a number: strip the
 * euro sign / NBSP / spaces, drop the thousands dots, turn the decimal comma into
 * a point.
 */
export function parseLocaleNumber(raw: string): number {
  const cleaned = raw
    .replace(/[^0-9.,]/g, "")
    .trim();

  const commaCount = (cleaned.match(/,/g) ?? []).length;
  const dotCount = (cleaned.match(/\./g) ?? []).length;

  if (commaCount > 0 && dotCount > 0) {
    const commaAfterDot = cleaned.lastIndexOf(",") > cleaned.lastIndexOf(".");
    return Number(
      commaAfterDot ? cleaned.replace(/\./g, "").replace(",", ".") : cleaned.replace(/,/g, ""),
    );
  }

  if (commaCount > 0) {
    return Number(cleaned.replace(/\./g, "").replace(",", "."));
  }

  if (dotCount > 0) {
    const dotParts = cleaned.split(".");
    if (dotParts.length > 1 && dotParts[dotParts.length - 1]?.length === 3) {
      return Number(dotParts.join(""));
    }
  }

  return Number(cleaned);
}

function getCell(cells: string[], index: number | null): string {
  if (index === null) return "";
  return cells[index]?.trim() ?? "";
}

function resolveTextField(
  cells: string[],
  index: number | null,
  fallback: string | undefined,
): string | null {
  const cell = getCell(cells, index);
  if (cell.length > 0) return cell;
  if (fallback && fallback.trim().length > 0) return fallback.trim();
  return null;
}

export function parseInvestmentDate(raw: string): Date | null {
  const local = parseDate(raw, "dd/MM/yyyy", new Date());
  if (isValid(local)) return local;
  const iso = parseISO(raw);
  if (isValid(iso)) return iso;
  return null;
}

export function parseInvestmentCsv(
  bytes: Uint8Array | ArrayBuffer,
  inputMap?: InvestmentImportColumnMap,
): ParseResult {
  const text = decode(bytes);
  const lines = text.split(/\r?\n/);
  const rows: ParsedInvestmentRow[] = [];
  const errors: ParseError[] = [];
  const mapping = investmentImportColumnMapSchema.parse(inputMap ?? legacyColumnMap);

  const firstNonEmpty = lines.find((l) => l.trim().length > 0) ?? "";
  const delimiter = detectDelimiter(firstNonEmpty);
  let skippedHeader = false;

  lines.forEach((rawLine, i) => {
    const line = i + 1;
    if (rawLine.trim().length === 0) return;
    if (mapping.skipHeader && !skippedHeader) {
      skippedHeader = true;
      return;
    }

    const cells = rawLine.split(delimiter).map((c) => c.trim());

    const raw = rawLine.trim();
    const ticker = resolveTextField(cells, mapping.ticker, mapping.defaults.ticker);
    if (!ticker) {
      errors.push({ line, raw, message: "Missing ticker" });
      return;
    }
    const broker = resolveTextField(cells, mapping.broker, mapping.defaults.broker);
    if (!broker) {
      errors.push({ line, raw, message: "Missing broker" });
      return;
    }

    const dateStr = resolveTextField(cells, mapping.date, mapping.defaults.date);
    if (!dateStr) {
      errors.push({ line, raw, message: "Missing date" });
      return;
    }

    const parsedDate = parseInvestmentDate(dateStr);
    if (!parsedDate) {
      errors.push({ line, raw, message: `Invalid date "${dateStr}"` });
      return;
    }

    const priceStr = getCell(cells, mapping.price);
    if (!priceStr) {
      errors.push({ line, raw, message: "Missing price" });
      return;
    }
    const price = parseLocaleNumber(priceStr);
    if (!Number.isFinite(price) || price < 0) {
      errors.push({ line, raw, message: `Invalid price "${priceStr}"` });
      return;
    }

    const quantityStr = getCell(cells, mapping.quantity);
    if (!quantityStr) {
      errors.push({ line, raw, message: "Missing quantity" });
      return;
    }
    const quantity = parseLocaleNumber(quantityStr);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      errors.push({ line, raw, message: `Invalid quantity "${quantityStr}"` });
      return;
    }

    const totalStr = getCell(cells, mapping.total);
    const total = totalStr ? parseLocaleNumber(totalStr) : NaN;

    rows.push({
      ticker,
      broker,
      date: format(parsedDate, "yyyy-MM-dd"),
      quantity,
      price,
      total: Number.isFinite(total) ? total : null,
    });
  });

  return { rows, errors };
}
