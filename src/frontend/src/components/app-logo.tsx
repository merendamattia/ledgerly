import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

/** Renders the shared Ledgerly identity with an optional route label. */
export function AppLogo({
  label,
  compact = false,
  copyClassName,
  className,
}: {
  label?: string;
  compact?: boolean;
  copyClassName?: string;
  className?: string;
}) {
  return (
    <Link
      href="/"
      aria-label="Ledgerly overview"
      className={cn(
        "flex min-w-0 items-center gap-2.5 rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
        className,
      )}
    >
      <span className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-sidebar sm:size-10">
        <Image
          src="/icons/icon-192.png"
          alt=""
          width={192}
          height={192}
          priority
          unoptimized
          className="size-full object-cover"
        />
      </span>
      {!compact ? (
        <span data-slot="app-logo-copy" className={cn("min-w-0", copyClassName)}>
          <span className="block truncate font-display text-lg leading-tight font-bold tracking-tight">
            Ledgerly
          </span>
          {label ? (
            <span className="block truncate text-xs leading-tight text-muted-foreground">{label}</span>
          ) : null}
        </span>
      ) : null}
    </Link>
  );
}
