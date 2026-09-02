"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
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

function formatReleaseDate(date: string, locale: string): string {
  const [year, month, day] = date.split("-").map(Number);
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

/** Announces the latest built release once per authenticated user. */
export function ReleaseAnnouncement() {
  const t = useTranslations("release");
  const locale = useLocale();
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
          toast.error(error.message || t("saveError"));
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
      <DialogContent className="inset-x-3 top-1/2 bottom-auto max-h-[calc(100dvh-1.5rem)] w-auto -translate-y-1/2 rounded-2xl pb-4 data-open:slide-in-from-bottom-0 data-closed:slide-out-to-bottom-0 sm:max-w-lg">
        <DialogHeader className="gap-3">
          <div className="flex items-start gap-3">
            <div
              aria-hidden="true"
              className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm"
            >
              <Sparkles className="size-5" />
            </div>
            <div className="min-w-0">
              <DialogTitle>{t("title")}</DialogTitle>
              <DialogDescription>{t("description")}</DialogDescription>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge>
              <span className="font-mono tabular-nums">v{releaseInfo.version}</span>
            </Badge>
            {releaseInfo.date ? (
              <span className="text-xs text-muted-foreground">
                {t("released", { date: formatReleaseDate(releaseInfo.date, locale) })}
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
            <AlertTitle>{t("saveErrorTitle")}</AlertTitle>
            <AlertDescription>{t("retry")}</AlertDescription>
          </Alert>
        ) : null}

        <DialogFooter>
          <Button
            className="w-full sm:w-auto"
            disabled={acknowledgement.isPending}
            onClick={acknowledgeAndClose}
          >
            {acknowledgement.isPending ? <Spinner data-icon="inline-start" /> : null}
            {acknowledgement.isPending ? t("saving") : t("confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
