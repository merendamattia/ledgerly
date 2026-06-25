import { cn } from "@/lib/utils";

// A category style: the tints used by both the leading tile and the pill badge,
// taken from the "modern ledger" design's categorical palette, plus a default
// emoji guessed from the category name.
type CategoryStyle = {
  emoji: string;
  badgeBg: string;
  badgeFg: string;
};

const RULES: [RegExp, CategoryStyle][] = [
  [/income|salary|stipend|payroll|divid|entrat|wage|bonus|refund|rimbors|credit|win|lotter|premio/i, { emoji: "💰", badgeBg: "#E7F3EC", badgeFg: "#1C7A4D" }],
  [/invest|etf|stock|equit|azion|crypto|btc|fund/i, { emoji: "📈", badgeBg: "#E7F3EC", badgeFg: "#1C7A4D" }],
  [/groc|aliment|food|superm|spesa/i, { emoji: "🛒", badgeBg: "#EEF6DC", badgeFg: "#5B7D10" }],
  [/rent|affitto|mortgage|mutuo|hous|home|casa/i, { emoji: "🏠", badgeBg: "#E7EEF8", badgeFg: "#2C5797" }],
  [/util|energ|enel|electric|gas|water|bollet/i, { emoji: "💡", badgeBg: "#E7EEF8", badgeFg: "#2C5797" }],
  [/transp|trasport|fuel|car|auto|train|treno|metro|bus/i, { emoji: "🚗", badgeBg: "#E7EEF8", badgeFg: "#2C5797" }],
  [/subscr|abbonam|netflix|spotify|stream/i, { emoji: "🎬", badgeBg: "#F1EAFB", badgeFg: "#6A4CC0" }],
  [/restaur|ristor|dining/i, { emoji: "🍽️", badgeBg: "#F1EAFB", badgeFg: "#6A4CC0" }],
  [/leisure|svago|bar|caff|entertain|fun|relax/i, { emoji: "🍹", badgeBg: "#F1EAFB", badgeFg: "#6A4CC0" }],
  [/health|salut|medic|pharm|farma/i, { emoji: "🏥", badgeBg: "#FDF1DD", badgeFg: "#B07415" }],
  [/cloth|abbigl/i, { emoji: "👕", badgeBg: "#FBE9E3", badgeFg: "#B0461F" }],
  [/shop|amazon/i, { emoji: "🛍️", badgeBg: "#FBE9E3", badgeFg: "#B0461F" }],
  [/flight|volo|aere/i, { emoji: "✈️", badgeBg: "#E7EEF8", badgeFg: "#2C5797" }],
  [/travel|viagg|hotel|holiday|vacan|ferie/i, { emoji: "🌴", badgeBg: "#E7EEF8", badgeFg: "#2C5797" }],
  [/sport|gym|palestr|fitness/i, { emoji: "🏋️", badgeBg: "#FDF1DD", badgeFg: "#B07415" }],
  [/tech|tecnolog|hardware|software|gadget/i, { emoji: "💻", badgeBg: "#E7EEF8", badgeFg: "#2C5797" }],
  [/phone|telefon|mobile|sim/i, { emoji: "📱", badgeBg: "#E7EEF8", badgeFg: "#2C5797" }],
  [/educat|school|scuol|stud|cours|cors|book|libr/i, { emoji: "🎓", badgeBg: "#FDF1DD", badgeFg: "#B07415" }],
  [/gift|regal|dona/i, { emoji: "🎁", badgeBg: "#FBE9E3", badgeFg: "#B0461F" }],
  [/hairdress|parruc|barber|beauty|estet/i, { emoji: "💇", badgeBg: "#FBE9E3", badgeFg: "#B0461F" }],
  [/service|servizi/i, { emoji: "🧰", badgeBg: "#F0EEE4", badgeFg: "#807F70" }],
  [/bank|cash|conto/i, { emoji: "💵", badgeBg: "#EEF6DC", badgeFg: "#5B7D10" }],
];

const FALLBACK: CategoryStyle = { emoji: "🏷️", badgeBg: "#F0EEE4", badgeFg: "#807F70" };

/** Resolves the configured color and emoji style for a category name. */
function styleFor(name?: string | null): CategoryStyle {
  if (!name) return FALLBACK;
  for (const [rx, style] of RULES) if (rx.test(name)) return style;
  return FALLBACK;
}

/**
 * Returns the default emoji guessed from a category name.
 *
 * Used as a suggestion when creating a category and as a fallback for categories
 * without a stored emoji.
 */
export function emojiFor(name?: string | null): string {
  return styleFor(name).emoji;
}

/** Renders the leading category tile used by transaction rows. */
export function CategoryIcon({
  name,
  emoji,
  className,
}: {
  name?: string | null;
  emoji?: string | null;
  className?: string;
}) {
  const style = styleFor(name);
  return (
    <div
      className={cn(
        "flex size-8 shrink-0 items-center justify-center rounded-[9px] text-base leading-none",
        className,
      )}
      style={{ background: style.badgeBg }}
    >
      <span aria-hidden>{emoji || style.emoji}</span>
    </div>
  );
}

/** Renders a small tinted pill with the category emoji and label. */
export function CategoryBadge({
  name,
  emoji,
}: {
  name?: string | null;
  emoji?: string | null;
}) {
  if (!name) return <span className="text-muted-foreground">—</span>;
  const style = styleFor(name);
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11.5px] font-semibold capitalize"
      style={{ background: style.badgeBg, color: style.badgeFg }}
    >
      <span aria-hidden>{emoji || style.emoji}</span>
      {name}
    </span>
  );
}
