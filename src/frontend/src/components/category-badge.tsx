import { createElement } from "react";
import {
  ShoppingCart,
  Banknote,
  Home,
  UtensilsCrossed,
  ShoppingBag,
  Car,
  Plane,
  HeartPulse,
  TrendingUp,
  Clapperboard,
  Tag,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

// A category style: an icon plus the tints used by both the leading tile and the
// pill badge, taken from the "modern ledger" design's categorical palette.
type CategoryStyle = {
  icon: LucideIcon;
  badgeBg: string;
  badgeFg: string;
};

const RULES: [RegExp, CategoryStyle][] = [
  [/income|salary|stipend|payroll|reddit|divid|entrat/i, { icon: TrendingUp, badgeBg: "#E7F3EC", badgeFg: "#1C7A4D" }],
  [/invest|etf|stock|equit|azion|crypto|btc|fund/i, { icon: TrendingUp, badgeBg: "#E7F3EC", badgeFg: "#1C7A4D" }],
  [/groc|aliment|food|superm|spesa/i, { icon: ShoppingCart, badgeBg: "#EEF6DC", badgeFg: "#5B7D10" }],
  [/rent|affitto|mortgage|mutuo|hous|casa|util|energ|enel|electric|gas|water|bollet/i, { icon: Home, badgeBg: "#E7EEF8", badgeFg: "#2C5797" }],
  [/transp|trasport|fuel|car|auto|train|treno|metro|bus/i, { icon: Car, badgeBg: "#E7EEF8", badgeFg: "#2C5797" }],
  [/subscr|abbonam|netflix|spotify|stream/i, { icon: Clapperboard, badgeBg: "#F1EAFB", badgeFg: "#6A4CC0" }],
  [/leisure|svago|restaur|ristor|dining|bar|caff|entertain|fun/i, { icon: UtensilsCrossed, badgeBg: "#F1EAFB", badgeFg: "#6A4CC0" }],
  [/health|salut|medic|pharm|farma/i, { icon: HeartPulse, badgeBg: "#FDF1DD", badgeFg: "#B07415" }],
  [/shop|amazon|cloth|abbigl/i, { icon: ShoppingBag, badgeBg: "#FBE9E3", badgeFg: "#B0461F" }],
  [/travel|flight|viagg|hotel/i, { icon: Plane, badgeBg: "#E7EEF8", badgeFg: "#2C5797" }],
  [/util|bank|cash|salar|wage|bonus/i, { icon: Banknote, badgeBg: "#EEF6DC", badgeFg: "#5B7D10" }],
];

const FALLBACK: CategoryStyle = { icon: Tag, badgeBg: "#F0EEE4", badgeFg: "#807F70" };

function styleFor(name?: string | null): CategoryStyle {
  if (!name) return FALLBACK;
  for (const [rx, style] of RULES) if (rx.test(name)) return style;
  return FALLBACK;
}

// Leading icon tile for a transaction row: a soft-tinted rounded square with the
// category's representative icon.
export function CategoryIcon({
  name,
  className,
}: {
  name?: string | null;
  className?: string;
}) {
  const style = styleFor(name);
  return (
    <div
      className={cn("flex size-8 shrink-0 items-center justify-center rounded-[9px]", className)}
      style={{ background: style.badgeBg, color: style.badgeFg }}
    >
      {createElement(style.icon, { className: "size-4" })}
    </div>
  );
}

// Small tinted pill showing the category name, colored per the design palette.
export function CategoryBadge({ name }: { name?: string | null }) {
  if (!name) return <span className="text-muted-foreground">—</span>;
  const style = styleFor(name);
  return (
    <span
      className="inline-flex items-center rounded-md px-2.5 py-1 text-[11.5px] font-semibold capitalize"
      style={{ background: style.badgeBg, color: style.badgeFg }}
    >
      {name}
    </span>
  );
}
