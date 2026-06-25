import { test, expect } from "bun:test";
import { parseBudjetExport } from "./budjet-csv.ts";

/** Encodes a string as UTF-16LE bytes with a BOM, matching the Budjet export. */
function toUtf16le(str: string): Uint8Array {
  const bytes = new Uint8Array(2 + str.length * 2);
  bytes[0] = 0xff;
  bytes[1] = 0xfe;
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    bytes[2 + i * 2] = code & 0xff;
    bytes[2 + i * 2 + 1] = code >> 8;
  }
  return bytes;
}

const HEADER = `"Type"\t"Category"\t"Date"\t"Transaction"\t"Note"`;

/** Builds a minimal Budjet TSV export with the shared header row. */
function build(...rows: string[]): Uint8Array {
  return toUtf16le([HEADER, ...rows].join("\n"));
}

test("parses an expense with U+2212 minus, NBSP and euro sign", () => {
  const { rows, errors } = parseBudjetExport(
    build(`"Expenses"\t"investments"\t"14 Jun 2026"\t"−10 €"\t"#bondora "`),
  );
  expect(errors).toEqual([]);
  expect(rows).toHaveLength(1);
  expect(rows[0]).toEqual({
    direction: "EXPENSE",
    category: "investments",
    date: "2026-06-14",
    amount: 10,
    note: "#bondora",
  });
});

test("parses a decimal comma amount", () => {
  const { rows } = parseBudjetExport(
    build(`"Expenses"\t"utilities"\t"13 Jun 2026"\t"−5,99 €"\t"icloud"`),
  );
  expect(rows[0]?.amount).toBe(5.99);
});

test("parses thousands-dot amounts (income and expense)", () => {
  const { rows } = parseBudjetExport(
    build(
      `"Income"\t"salary"\t"11 Jun 2026"\t"2.029 €"\t"stipendio"`,
      `"Expenses"\t"investments"\t"17 May 2026"\t"−1.250 €"\t"PAC"`,
    ),
  );
  expect(rows[0]).toMatchObject({ direction: "INCOME", amount: 2029 });
  expect(rows[1]).toMatchObject({ direction: "EXPENSE", amount: 1250 });
});

test("keeps a note that contains an embedded newline as one row", () => {
  const { rows, errors } = parseBudjetExport(
    build(`"Expenses"\t"grocery"\t"4 Apr 2026"\t"−30 €"\t"line one\nline two"`),
  );
  expect(errors).toEqual([]);
  expect(rows).toHaveLength(1);
  expect(rows[0]?.note).toBe("line one\nline two");
});

test("lowercases categories and maps empty notes to null", () => {
  const { rows } = parseBudjetExport(
    build(`"Income"\t"Gifts"\t"6 Jun 2026"\t"50 €"\t""`),
  );
  expect(rows[0]?.category).toBe("gifts");
  expect(rows[0]?.note).toBeNull();
});

test("collects errors for unknown type and invalid date", () => {
  const { rows, errors } = parseBudjetExport(
    build(
      `"Savings"\t"x"\t"1 Jan 2026"\t"5 €"\t""`,
      `"Income"\t"salary"\t"not a date"\t"5 €"\t""`,
    ),
  );
  expect(rows).toHaveLength(0);
  expect(errors).toHaveLength(2);
});

test("parses the real Budjet export when present", async () => {
  const path = new URL("../../../../tmp/Budjet-Export.csv", import.meta.url);
  const file = Bun.file(path);
  if (!(await file.exists())) return; // optional fixture
  const { rows, errors } = parseBudjetExport(await file.arrayBuffer());
  expect(errors).toEqual([]);
  expect(rows.length).toBeGreaterThan(2000);
  for (const r of rows) {
    expect(r.amount).toBeGreaterThan(0);
    expect(r.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  }
});
