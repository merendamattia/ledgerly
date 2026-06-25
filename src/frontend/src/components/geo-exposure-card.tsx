import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

// Regions mirror the design's geographic breakdown. Real per-holding exposure
// isn't available yet (pending a provider feed), so this renders as a styled
// "coming soon" placeholder — no fabricated numbers — ready to wire later.
const REGIONS = [
  { flag: "🇺🇸", name: "North America" },
  { flag: "🇪🇺", name: "Europe" },
  { flag: "🌏", name: "Asia–Pacific" },
  { flag: "🌎", name: "Emerging" },
  { flag: "🌐", name: "Global / other" },
];

/** Renders the placeholder geographic exposure panel until provider data exists. */
export function GeoExposureCard({ className }: { className?: string }) {
  return (
    <Card className={cn("gap-0 border shadow-card ring-0 p-6 animate-fu", className)}>
      <div className="mb-4 flex items-center justify-between">
        <p className="font-display text-base font-semibold">Geographic exposure</p>
        <span className="rounded-full bg-muted px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">
          Coming soon
        </span>
      </div>
      <div className="flex flex-col gap-3.5">
        {REGIONS.map((r) => (
          <div key={r.name}>
            <div className="mb-1.5 flex items-center justify-between text-xs">
              <span className="flex items-center gap-2 font-medium text-muted-foreground">
                <span aria-hidden>{r.flag}</span>
                {r.name}
              </span>
              <span className="font-mono tabular-nums text-muted-foreground/60">—</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div className="h-full w-1/4 rounded-full bg-muted-foreground/15" />
            </div>
          </div>
        ))}
      </div>
      <p className="mt-4 border-t pt-3.5 text-xs text-muted-foreground">
        Region breakdown will appear once asset exposure data is available.
      </p>
    </Card>
  );
}
