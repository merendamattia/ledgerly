import { createElement } from "react";
import {
  ShoppingCart,
  Banknote,
  Home,
  Zap,
  UtensilsCrossed,
  ShoppingBag,
  Car,
  Plane,
  HeartPulse,
  Tag,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

// Best-effort mapping from a category name to a representative icon.
const ICON_RULES: [RegExp, LucideIcon][] = [
  [/groc|aliment|food|superm|spesa/i, ShoppingCart],
  [/salary|income|stipend|reddit|payroll/i, Banknote],
  [/rent|affitto|mortgage|mutuo|hous|casa/i, Home],
  [/util|energ|enel|electric|gas|water|bollet/i, Zap],
  [/restaur|ristor|dining|bar|caff/i, UtensilsCrossed],
  [/shop|amazon|cloth|abbigl/i, ShoppingBag],
  [/transp|fuel|car|auto|train|treno/i, Car],
  [/travel|flight|viagg|hotel/i, Plane],
  [/health|salut|medic|pharm|farma/i, HeartPulse],
];

function pickIcon(name?: string | null): LucideIcon {
  if (!name) return Tag;
  for (const [rx, icon] of ICON_RULES) if (rx.test(name)) return icon;
  return Tag;
}

// Leading icon tile for a transaction row. Neutral by design: categories carry
// no color, the icon (chosen from the name) and label do the work.
export function CategoryIcon({
  name,
  className,
}: {
  name?: string | null;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground",
        className,
      )}
    >
      {createElement(pickIcon(name), { className: "size-4" })}
    </div>
  );
}

// Small neutral pill showing the category name.
export function CategoryBadge({ name }: { name?: string | null }) {
  if (!name) return <span className="text-muted-foreground">—</span>;
  return (
    <span className="inline-flex items-center rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium text-secondary-foreground">
      {name}
    </span>
  );
}
