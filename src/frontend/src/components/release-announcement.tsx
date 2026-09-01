"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";
import { releaseInfo } from "@/generated/release-info";
import { useAcknowledgeRelease, useSettings } from "@/hooks/use-settings";
import { shouldShowReleaseAnnouncement } from "@/lib/release-version";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";

function formatReleaseDate(date: string): string {
  const [year, month, day] = date.split("-").map(Number);
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

/** Announces the latest built release once per authenticated user. */
export function ReleaseAnnouncement() {
  const settings = useSettings();
  const acknowledgement = useAcknowledgeRelease();
  const shouldAnnounce = settings.data
    ? shouldShowReleaseAnnouncement(
        releaseInfo.version,
        settings.data.lastSeenReleaseVersion,
      )
    : false;
  const [dismissedVersion, setDismissedVersion] = useState<string | null>(null);
  const open = shouldAnnounce && dismissedVersion !== releaseInfo.version;

  function acknowledgeAndClose() {
    if (acknowledgement.isPending || dismissedVersion === releaseInfo.version) return;

    setDismissedVersion(releaseInfo.version);
    acknowledgement.mutate(
      { version: releaseInfo.version },
      {
        onError: (error) => {
          setDismissedVersion(null);
          toast.error(error.message || "Release acknowledgement could not be saved");
        },
      },
    );
  }

  function handleOpenChange(nextOpen: boolean) {
    if (nextOpen) return;
    acknowledgeAndClose();
  }

  if (!settings.data || !shouldAnnounce) return null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader className="gap-3">
          <div className="flex items-start gap-3">
            <div
              aria-hidden="true"
              className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm"
            >
              <Sparkles className="size-5" />
            </div>
            <div className="min-w-0">
              <DialogTitle>New version available</DialogTitle>
              <DialogDescription>
                Ledgerly has a fresh set of improvements.
              </DialogDescription>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge>
              <span className="font-mono tabular-nums">v{releaseInfo.version}</span>
            </Badge>
            {releaseInfo.date ? (
              <span className="text-xs text-muted-foreground">
                Released {formatReleaseDate(releaseInfo.date)}
              </span>
            ) : null}
          </div>
        </DialogHeader>

        <div className="flex max-h-[50dvh] flex-col gap-5 overflow-y-auto pr-1">
          {releaseInfo.sections.map((section) => (
            <section key={section.title} className="flex flex-col gap-2.5">
              <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                {section.title}
              </h3>
              <ul className="flex list-disc flex-col gap-2 pl-5 marker:text-positive">
                {section.items.map((item) => (
                  <li key={item} className="text-sm leading-relaxed">
                    {item}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        {acknowledgement.isError ? (
          <Alert variant="destructive">
            <AlertTitle>Release acknowledgement could not be saved.</AlertTitle>
            <AlertDescription>Close again to retry.</AlertDescription>
          </Alert>
        ) : null}

        <DialogFooter>
          <Button
            className="w-full sm:w-auto"
            disabled={acknowledgement.isPending}
            onClick={acknowledgeAndClose}
          >
            {acknowledgement.isPending ? <Spinner data-icon="inline-start" /> : null}
            {acknowledgement.isPending ? "Saving..." : "Got it"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
