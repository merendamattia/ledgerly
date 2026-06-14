/**
 * Canonical form of a category name: trimmed, lowercased, inner whitespace
 * collapsed. Applied on every write so a category is a single DB row regardless
 * of how it was typed ("Investments" / "investments" both become "investments"),
 * paired with the unique (kind, name) index that enforces it at the database.
 */
export function normalizeCategoryName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}
