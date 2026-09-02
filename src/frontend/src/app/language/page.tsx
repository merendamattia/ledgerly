"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AppLogo } from "@/components/app-logo";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { useSettings, useUpdateSettings } from "@/hooks/use-settings";
import { DEFAULT_LOCALE, isLocale, type Locale } from "@/i18n/config";
import { useSession } from "@/lib/auth-client";

/** Requires newly provisioned users to persist their own application language. */
export default function LanguagePage() {
  const router = useRouter();
  const activeLocale = useLocale();
  const t = useTranslations("onboarding");
  const common = useTranslations("common");
  const { data: session, isPending } = useSession();
  const settings = useSettings(!!session && !session.user.mustChangePassword);
  const update = useUpdateSettings();
  const [locale, setLocale] = useState<Locale>(isLocale(activeLocale) ? activeLocale : DEFAULT_LOCALE);

  useEffect(() => {
    if (!isPending && !session) router.replace("/login");
    if (!isPending && session?.user.mustChangePassword) router.replace("/change-password");
    if (settings.data?.locale) router.replace("/");
  }, [isPending, router, session, settings.data?.locale]);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    update.mutate(
      { locale },
      {
        onSuccess: () => router.replace("/"),
        onError: () => toast.error(t("saveError")),
      },
    );
  }

  if (isPending || !session || session.user.mustChangePassword || settings.isPending || settings.data?.locale) {
    return (
      <main className="flex min-h-svh items-center justify-center p-4">
        <Spinner className="size-6" />
      </main>
    );
  }

  return (
    <main className="flex min-h-svh items-center justify-center p-4">
      <AppLogo className="fixed top-6 left-6" />
      <Dialog open>
        <DialogContent showCloseButton={false} className="inset-x-3 top-1/2 bottom-auto w-auto -translate-y-1/2 rounded-2xl pb-4 sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("title")}</DialogTitle>
            <DialogDescription>{t("description")}</DialogDescription>
          </DialogHeader>
          <form onSubmit={submit} className="flex flex-col gap-4">
            <Field>
              <FieldLabel htmlFor="onboarding-language">{t("language")}</FieldLabel>
              <Select
                value={locale}
                items={{ en: common("english"), it: common("italian") }}
                onValueChange={(value) => {
                  if (isLocale(value)) setLocale(value);
                }}
              >
                <SelectTrigger id="onboarding-language" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="en">{common("english")}</SelectItem>
                    <SelectItem value="it">{common("italian")}</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
            <DialogFooter>
              <Button type="submit" className="w-full" disabled={update.isPending}>
                {update.isPending ? <Spinner data-icon="inline-start" /> : null}
                {t("continue")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </main>
  );
}
