"use client";

import Image from "next/image";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { BellRing, Copy, Info, KeyRound, RotateCw, ShieldCheck, Smartphone, Trash2 } from "lucide-react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import {
  useCreatePersonalApiToken,
  usePersonalApiToken,
  useRevokePersonalApiToken,
  useRotatePersonalApiToken,
} from "@/hooks/use-integration-token";
import {
  useDisablePushNotifications,
  useEnablePushNotifications,
  usePushConfiguration,
  useTestPushNotification,
} from "@/hooks/use-notifications";
import { formatDate } from "@/lib/format";

const SHORTCUT_LINK = "https://www.icloud.com/shortcuts/558cd615d3184128b915e0781b18f75e";

function CopyableValue({ label, value, success }: { label: string; value: string; success: string }) {
  const t = useTranslations("advanced");
  const [copied, setCopied] = useState(false);

  async function copyValue() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      toast.success(success);
    } catch {
      toast.error(t("copyFailed"));
    }
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border bg-muted/35 p-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <div className="min-w-0">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <code className="mt-1 block break-all font-mono text-xs leading-5">{value}</code>
      </div>
      <Button type="button" variant="outline" size="sm" onClick={() => void copyValue()} className="shrink-0 self-start sm:self-auto">
        <Copy data-icon="inline-start" />
        {copied ? t("copied") : t("copy")}
      </Button>
    </div>
  );
}

function OneTimeSecret({ secret, onDismiss }: { secret: string; onDismiss: () => void }) {
  const t = useTranslations("advanced");
  return (
    <Alert className="border-positive/40 bg-accent">
      <ShieldCheck />
      <AlertTitle>{t("saveTokenTitle")}</AlertTitle>
      <AlertDescription className="flex flex-col gap-3">
        <p>{t("saveTokenDescription")}</p>
        <CopyableValue label={t("personalToken")} value={secret} success={t("tokenCopied")} />
        <Button type="button" size="sm" variant="outline" onClick={onDismiss} className="self-start">
          {t("savedToken")}
        </Button>
      </AlertDescription>
    </Alert>
  );
}

function NotificationSettings() {
  const t = useTranslations("notifications");
  const config = usePushConfiguration();
  const enable = useEnablePushNotifications();
  const disable = useDisablePushNotifications();
  const testPush = useTestPushNotification();
  const pending = enable.isPending || disable.isPending || testPush.isPending;
  const active = !!config.data?.enabled && config.data.subscribed;

  function enableErrorMessage(error: unknown) {
    const message = error instanceof Error ? error.message.toLowerCase() : "";
    if (message === "unsupported") return t("unsupportedError");
    if (message === "denied" || message.includes("permission")) return t("permissionError");
    if (message === "invalid" || message.includes("applicationserverkey") || message.includes("vapid")) {
      return t("subscriptionError");
    }
    if (message.includes("failed to fetch") || message.includes("network")) return t("networkError");
    return t("subscriptionError");
  }

  async function enablePush() {
    if (!config.data?.publicKey) return;
    try {
      await enable.mutateAsync(config.data.publicKey);
      toast.success(t("enabledToast"));
    } catch (error) {
      toast.error(t("enableError"), { description: enableErrorMessage(error) });
    }
  }

  async function disablePush() {
    try {
      await disable.mutateAsync();
      toast.success(t("disabledToast"));
    } catch {
      toast.error(t("disableError"));
    }
  }

  async function sendTest() {
    try {
      await testPush.mutateAsync();
      toast.success(t("testSent"));
    } catch {
      toast.error(t("testError"));
    }
  }

  return (
    <section className="flex flex-col gap-3" aria-labelledby="push-notifications-title">
      <div className="flex items-start gap-2">
        <BellRing className="mt-0.5 size-4 shrink-0 text-primary" />
        <div>
          <h3 id="push-notifications-title" className="font-display font-semibold">{t("title")}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{t("settingsDescription")}</p>
        </div>
      </div>
      {config.isPending ? <Skeleton className="h-16 w-full" /> : null}
      {config.data && !config.data.available ? (
        <Alert><AlertDescription>{t("unavailable")}</AlertDescription></Alert>
      ) : null}
      {config.data?.available ? (
        <div className="flex flex-col gap-3 rounded-lg border bg-muted/35 p-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Badge variant={active ? "default" : "secondary"}>{active ? t("enabled") : t("disabled")}</Badge>
            <p className="mt-2 text-sm text-muted-foreground">{t("permissionHelp")}</p>
          </div>
          <div className="flex flex-wrap gap-2 sm:justify-end">
            {active ? (
              <Button type="button" variant="outline" disabled={pending} onClick={() => void sendTest()}>
                {testPush.isPending ? <Spinner data-icon="inline-start" /> : <BellRing data-icon="inline-start" />}
                {t("sendTest")}
              </Button>
            ) : null}
            <Button
              type="button"
              variant={active ? "outline" : "default"}
              disabled={pending}
              onClick={() => void (active ? disablePush() : enablePush())}
            >
              {(enable.isPending || disable.isPending) ? <Spinner data-icon="inline-start" /> : <BellRing data-icon="inline-start" />}
              {active ? t("disable") : t("enable")}
            </Button>
          </div>
        </div>
      ) : null}
    </section>
  );
}

export function AdvancedSettingsCard() {
  const t = useTranslations("advanced");
  const status = usePersonalApiToken();
  const create = useCreatePersonalApiToken();
  const rotate = useRotatePersonalApiToken();
  const revoke = useRevokePersonalApiToken();
  const [secret, setSecret] = useState<string | null>(null);
  const [requestFailed, setRequestFailed] = useState(false);
  const metadata = status.data?.token;
  const pending = create.isPending || rotate.isPending || revoke.isPending;

  async function generate() {
    setRequestFailed(false);
    try {
      const result = await create.mutateAsync();
      setSecret(result.token);
      toast.success(t("tokenGenerated"));
    } catch {
      setRequestFailed(true);
    }
  }

  async function rotateToken() {
    setRequestFailed(false);
    try {
      const result = await rotate.mutateAsync();
      setSecret(result.token);
      toast.success(t("tokenRotated"));
    } catch {
      setRequestFailed(true);
    }
  }

  async function revokeToken() {
    setRequestFailed(false);
    try {
      await revoke.mutateAsync();
      setSecret(null);
      toast.success(t("tokenRevoked"));
    } catch {
      setRequestFailed(true);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><KeyRound className="size-4 text-primary" />{t("title")}</CardTitle>
        <CardDescription>{t("description")}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <section className="flex flex-col gap-3" aria-labelledby="apple-pay-title">
          <div className="flex items-start gap-2">
            <Smartphone className="mt-0.5 size-4 shrink-0 text-primary" />
            <div>
              <h3 id="apple-pay-title" className="font-display font-semibold">{t("applePayTitle")}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{t("applePayDescription")}</p>
            </div>
          </div>
          <CopyableValue label={t("shortcutLink")} value={SHORTCUT_LINK} success={t("shortcutCopied")} />

          {secret ? <OneTimeSecret secret={secret} onDismiss={() => setSecret(null)} /> : null}
          {requestFailed || status.isError ? (
            <Alert variant="destructive"><AlertDescription>{t("requestFailed")}</AlertDescription></Alert>
          ) : null}
          {status.isPending ? <Skeleton className="h-20 w-full" /> : null}
          {!status.isPending && !status.isError && metadata ? (
            <div className="flex flex-col gap-4 rounded-lg border bg-muted/35 p-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex items-center gap-2"><Badge>{t("active")}</Badge><code className="font-mono text-sm">{metadata.prefix}…{metadata.suffix}</code></div>
                <p className="mt-1 text-sm text-muted-foreground">{t("created", { date: formatDate(metadata.createdAt) })}</p>
              </div>
              <div className="flex gap-2">
                <ConfirmDialog
                  title={t("rotateTitle")}
                  description={t("rotateDescription")}
                  confirmLabel={t("rotateToken")}
                  confirmVariant="destructive"
                  onConfirm={() => void rotateToken()}
                  trigger={<Button type="button" variant="outline" size="sm" disabled={pending}><RotateCw data-icon="inline-start" />{t("rotate")}</Button>}
                />
                <ConfirmDialog
                  title={t("revokeTitle")}
                  description={t("revokeDescription")}
                  confirmLabel={t("revokeToken")}
                  confirmVariant="destructive"
                  onConfirm={() => void revokeToken()}
                  trigger={<Button type="button" variant="destructive" size="sm" disabled={pending}><Trash2 data-icon="inline-start" />{t("revoke")}</Button>}
                />
              </div>
            </div>
          ) : null}
          {!status.isPending && !status.isError && !metadata ? (
            <div className="flex flex-col gap-3 rounded-lg border border-dashed p-3 sm:flex-row sm:items-center sm:justify-between">
              <div><p className="text-sm font-medium">{t("noTokenTitle")}</p><p className="mt-1 text-sm text-muted-foreground">{t("noTokenDescription")}</p></div>
              <Button type="button" onClick={() => void generate()} disabled={pending}>{pending ? <Spinner data-icon="inline-start" /> : <KeyRound data-icon="inline-start" />}{t("generateToken")}</Button>
            </div>
          ) : null}

          <ol className="flex list-decimal flex-col gap-2 pl-5 text-sm leading-6 text-muted-foreground marker:text-foreground">
            <li>{t("setupInstall")}</li>
            <li>{t("setupAutomation")}</li>
            <li>{t("setupRun")}</li>
          </ol>
          <figure className="mx-auto" style={{ width: "100%", maxWidth: 288 }}>
            <Image
              src="/images/iphone-wallet-automation.png"
              alt={t("automationScreenshotAlt")}
              width={1179}
              height={1343}
              sizes="(max-width: 640px) 72vw, 288px"
              className="h-auto w-full rounded-lg border"
            />
            <figcaption className="mt-2 text-xs leading-5 text-muted-foreground">{t("automationScreenshotCaption")}</figcaption>
          </figure>
          <Alert className="border-primary/25 bg-muted/35">
            <Info />
            <AlertTitle>{t("walletNoteTitle")}</AlertTitle>
            <AlertDescription>{t("walletNote")}</AlertDescription>
          </Alert>
        </section>
        <Separator />
        <NotificationSettings />
      </CardContent>
    </Card>
  );
}
