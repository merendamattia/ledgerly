"use client";

import Image from "next/image";
import { type ReactNode, useState } from "react";
import { toast } from "sonner";
import { Copy, KeyRound, RotateCw, ShieldCheck, Smartphone, Trash2 } from "lucide-react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import {
  useCreatePersonalApiToken,
  usePersonalApiToken,
  useRevokePersonalApiToken,
  useRotatePersonalApiToken,
} from "@/hooks/use-integration-token";
import { formatDate } from "@/lib/format";

const SHORTCUT_LINK = "https://www.icloud.com/shortcuts/a90eb7d1e7db4e79a00382b15e450102";
const API_BASE_URL = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001").replace(/\/+$/, "");
const INTEGRATION_ENDPOINT = `${API_BASE_URL}/api/integrations/transactions`;

/** Renders a copyable setup value without exposing it in a form field. */
function CopyableValue({
  label,
  value,
  successMessage,
}: {
  label: string;
  value: string;
  successMessage: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copyValue() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      toast.success(successMessage);
    } catch {
      toast.error("Copy failed. Select the value and copy it manually.");
    }
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border/80 bg-muted/35 p-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <div className="min-w-0">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <code className="mt-1 block break-all font-mono text-xs leading-5 text-foreground">{value}</code>
      </div>
      <Button type="button" variant="outline" size="sm" onClick={() => void copyValue()} className="shrink-0 self-start sm:self-auto">
        <Copy data-icon="inline-start" />
        {copied ? "Copied" : "Copy"}
      </Button>
    </div>
  );
}

/** Renders the one-time secret, with an explicit dismissal action. */
function OneTimeSecret({ secret, onDismiss }: { secret: string; onDismiss: () => void }) {
  return (
    <Alert className="border-positive/40 bg-accent">
      <ShieldCheck />
      <AlertTitle>Save this token now</AlertTitle>
      <AlertDescription className="flex flex-col gap-3">
        <p>
          The full token is shown only now. Copy the raw token for the Shortcut setup question, or
          copy the complete header for a manual request.
        </p>
        <CopyableValue label="Personal token" value={secret} successMessage="Token copied" />
        <CopyableValue
          label="Authorization header"
          value={`Bearer ${secret}`}
          successMessage="Authorization header copied"
        />
        <Button type="button" size="sm" variant="outline" onClick={onDismiss} className="self-start">
          I&apos;ve saved it
        </Button>
      </AlertDescription>
    </Alert>
  );
}

/** Renders the active token metadata and its rotation/revocation actions. */
function ActiveToken({
  prefix,
  suffix,
  createdAt,
  pending,
  onRotate,
  onRevoke,
}: {
  prefix: string;
  suffix: string;
  createdAt: string;
  pending: boolean;
  onRotate: () => void;
  onRevoke: () => void;
}) {
  return (
    <div className="flex flex-col gap-4 rounded-lg border border-border/80 bg-muted/35 p-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">Active</Badge>
          <code className="font-mono text-sm text-foreground">
            {prefix}…{suffix}
          </code>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">Created {formatDate(createdAt)}</p>
      </div>
      <div className="flex flex-wrap gap-2 sm:shrink-0">
        <ConfirmDialog
          title="Rotate integration token?"
          description="The current token will stop working immediately. Your automation will need the new token."
          confirmLabel="Rotate token"
          confirmVariant="destructive"
          onConfirm={onRotate}
          trigger={
            <Button type="button" variant="outline" size="sm" disabled={pending}>
              {pending ? <Spinner data-icon="inline-start" /> : <RotateCw data-icon="inline-start" />}
              Rotate
            </Button>
          }
        />
        <ConfirmDialog
          title="Revoke integration token?"
          description="Wallet automations using this token will stop creating transactions immediately."
          confirmLabel="Revoke token"
          confirmVariant="destructive"
          onConfirm={onRevoke}
          trigger={
            <Button type="button" variant="destructive" size="sm" disabled={pending}>
              <Trash2 data-icon="inline-start" />
              Revoke
            </Button>
          }
        />
      </div>
    </div>
  );
}

/** Renders the values and short setup flow for the shared iPhone shortcut. */
function IPhoneWalletInstructions({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col gap-3 border-t border-border/80 pt-5">
      <div className="flex items-start gap-2">
        <Smartphone className="mt-0.5 size-4 shrink-0 text-primary" />
        <div>
          <h3 className="font-display text-base font-semibold tracking-tight">
            iPhone Wallet setup
          </h3>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            Install the shared Shortcut, then connect it to a Wallet transaction automation.
          </p>
        </div>
      </div>
      <p className="text-xs leading-5 text-muted-foreground">
        <strong className="font-medium text-foreground">Note:</strong> This records Wallet payments
        as expenses, not bank-account synchronization. Rotate the token if it is exposed.
      </p>
      <div className="flex flex-col gap-3">
        <CopyableValue
          label="iCloud Shortcut link"
          value={SHORTCUT_LINK}
          successMessage="Shortcut link copied"
        />
        <CopyableValue
          label="Ledgerly API endpoint"
          value={INTEGRATION_ENDPOINT}
          successMessage="API endpoint copied"
        />
      </div>
      {children}
      <ol className="flex list-decimal flex-col gap-2 pl-5 text-sm leading-6 text-muted-foreground marker:text-foreground">
        <li>
          Open the iCloud link on your iPhone, tap <strong className="font-medium text-foreground">Get Shortcut</strong>,
          then answer the two setup questions with the API endpoint above and the raw token.
        </li>
        <li>
          In <strong className="font-medium text-foreground">Shortcuts → Automation → + → Wallet</strong>,
          select the cards, and choose <strong className="font-medium text-foreground">Run Immediately</strong>.
          Add a <strong className="font-medium text-foreground">Dictionary</strong> with:
          <ul className="mt-1 flex list-disc flex-col gap-1 pl-5">
            <li>
              Choose <strong className="font-medium text-foreground">Text</strong>. Set the key to{" "}
              <code className="font-mono text-xs text-foreground">merchant</code> and the value to the{" "}
              <strong className="font-medium text-foreground">Merchant</strong> variable.
            </li>
            <li>
              Choose <strong className="font-medium text-foreground">Number</strong>. Set the key to{" "}
              <code className="font-mono text-xs text-foreground">amount</code> and the value to the{" "}
              <strong className="font-medium text-foreground">Amount</strong> variable.
            </li>
          </ul>
          <p className="mt-1">
            To insert a value, tap its value field → <strong className="font-medium text-foreground">Select Variable</strong>
            → <strong className="font-medium text-foreground">Receive transaction as input</strong>, then choose{" "}
            <strong className="font-medium text-foreground">Merchant</strong> or{" "}
            <strong className="font-medium text-foreground">Amount</strong>. A blue variable chip means it is correct;
            do not type those words manually.
          </p>
          Then add <strong className="font-medium text-foreground">Run Shortcut → Ledgerly - Apple Pay</strong> and
          pass the Dictionary as its input.
        </li>
        <li>Run one test payment. The backend must be reachable from the iPhone over HTTPS.</li>
      </ol>
      <figure className="mx-auto flex w-full max-w-[280px] flex-col gap-2">
        <Image
          src="/images/iphone-wallet-automation.png"
          alt="Final iPhone Wallet automation showing transaction input, a Dictionary with blue Merchant and Amount variables, and Ledgerly - Apple Pay receiving that Dictionary"
          width={1179}
          height={1488}
          sizes="(max-width: 640px) 100vw, 448px"
          className="h-auto w-full rounded-xl border border-border/80"
        />
        <figcaption className="text-center text-xs leading-5 text-muted-foreground">
          Final configuration: both Dictionary values are blue transaction variables, and Run Shortcut receives the Dictionary as input.
        </figcaption>
      </figure>
    </div>
  );
}

/** Renders personal API-token management for every authenticated user. */
export function AdvancedSettingsCard() {
  const status = usePersonalApiToken();
  const create = useCreatePersonalApiToken();
  const rotate = useRotatePersonalApiToken();
  const revoke = useRevokePersonalApiToken();
  const [secret, setSecret] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const metadata = status.data?.token;
  const pending = create.isPending || rotate.isPending || revoke.isPending;

  async function generate() {
    setError(null);
    try {
      const result = await create.mutateAsync();
      setSecret(result.token);
      toast.success("Integration token generated");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to generate token");
    }
  }

  async function rotateToken() {
    setError(null);
    try {
      const result = await rotate.mutateAsync();
      setSecret(result.token);
      toast.success("Integration token rotated");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to rotate token");
    }
  }

  async function revokeToken() {
    setError(null);
    try {
      await revoke.mutateAsync();
      setSecret(null);
      toast.success("Integration token revoked");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to revoke token");
    }
  }

  function dismissSecret() {
    setSecret(null);
    create.reset();
    rotate.reset();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <KeyRound className="size-4 text-primary" />
          Advanced
        </CardTitle>
        <CardDescription>
          Connect an iPhone Wallet automation without storing your Ledgerly password in Shortcuts.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <IPhoneWalletInstructions>
          {secret ? <OneTimeSecret secret={secret} onDismiss={dismissSecret} /> : null}
          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
          {status.isPending ? <Skeleton className="h-20 w-full rounded-lg" /> : null}
          {status.isError ? (
            <Alert variant="destructive">
              <AlertTitle>Token status unavailable</AlertTitle>
              <AlertDescription>{status.error.message}</AlertDescription>
            </Alert>
          ) : null}
          {!status.isPending && !status.isError && metadata ? (
            <ActiveToken
              prefix={metadata.prefix}
              suffix={metadata.suffix}
              createdAt={metadata.createdAt}
              pending={pending}
              onRotate={() => void rotateToken()}
              onRevoke={() => void revokeToken()}
            />
          ) : null}
          {!status.isPending && !status.isError && !metadata ? (
            <div className="flex flex-col gap-3 rounded-lg border border-dashed border-border/80 p-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-medium">No automation token yet</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Generate one to let an iPhone Shortcut create expenses for this account.
                </p>
              </div>
              <Button type="button" onClick={() => void generate()} disabled={pending} className="w-full sm:w-fit">
                {pending ? <Spinner data-icon="inline-start" /> : <KeyRound data-icon="inline-start" />}
                Generate token
              </Button>
            </div>
          ) : null}
        </IPhoneWalletInstructions>
      </CardContent>
    </Card>
  );
}
