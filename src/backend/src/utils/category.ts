/**
 * Canonical form of a category name: trimmed, lowercased, inner whitespace
 * collapsed. Applied on every write so a category is a single DB row regardless
 * of how it was typed ("Investments" / "investments" both become "investments"),
 * paired with the unique (kind, name) index that enforces it at the database.
 */
export function normalizeCategoryName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

// Name → default emoji guess, mirroring the frontend's `emojiFor` rules
// (src/frontend/src/components/category-badge.tsx). Used to backfill existing
// categories that have no stored emoji.
const EMOJI_RULES: [RegExp, string][] = [
  [/income|salary|stipend|payroll|divid|entrat|wage|bonus|refund|rimbors|credit|win|lotter|premio/i, "💰"],
  [/invest|etf|stock|equit|azion|crypto|btc|fund/i, "📈"],
  [/groc|aliment|food|superm|spesa/i, "🛒"],
  [/rent|affitto|mortgage|mutuo|hous|home|casa/i, "🏠"],
  [/util|energ|enel|electric|gas|water|bollet/i, "💡"],
  [/transp|trasport|fuel|car|auto|train|treno|metro|bus/i, "🚗"],
  [/subscr|abbonam|netflix|spotify|stream/i, "🎬"],
  [/restaur|ristor|dining/i, "🍽️"],
  [/leisure|svago|bar|caff|entertain|fun|relax/i, "🍹"],
  [/health|salut|medic|pharm|farma/i, "🏥"],
  [/cloth|abbigl/i, "👕"],
  [/shop|amazon/i, "🛍️"],
  [/flight|volo|aere/i, "✈️"],
  [/travel|viagg|hotel|holiday|vacan|ferie/i, "🌴"],
  [/sport|gym|palestr|fitness/i, "🏋️"],
  [/tech|tecnolog|hardware|software|gadget/i, "💻"],
  [/phone|telefon|mobile|sim/i, "📱"],
  [/educat|school|scuol|stud|cours|cors|book|libr/i, "🎓"],
  [/gift|regal|dona/i, "🎁"],
  [/hairdress|parruc|barber|beauty|estet/i, "💇"],
  [/service|servizi/i, "🧰"],
  [/bank|cash|conto/i, "💵"],
];

export function defaultEmojiForCategory(name: string): string {
  for (const [rx, emoji] of EMOJI_RULES) if (rx.test(name)) return emoji;
  return "🏷️";
}
