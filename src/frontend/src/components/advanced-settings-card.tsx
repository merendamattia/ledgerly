"use client";

import { useState } from "react";
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

/** Renders the one-time secret, with an explicit dismissal action. */
function OneTimeSecret({ secret, onDismiss }: { secret: string; onDismiss: () => void }) {
  const [copied, setCopied] = useState(false);

  async function copySecret() {
    try {
      await navigator.clipboard.writeText(secret);
      setCopied(true);
      toast.success("Token copied");
    } catch {
      toast.error("Copy failed. Select the token and copy it manually.");
    }
  }

  return (
    <Alert className="border-positive/40 bg-accent">
      <ShieldCheck />
      <AlertTitle>Save this token now</AlertTitle>
      <AlertDescription className="flex flex-col gap-3">
        <p>
          This is the only time Ledgerly will show the full token. Treat it like a password and
          replace it in Shortcuts if it is ever exposed.
        </p>
        <code className="block rounded-md border border-border/80 bg-card px-3 py-2 font-mono text-xs leading-5 break-all text-foreground">
          {secret}
        </code>
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" onClick={copySecret}>
            <Copy data-icon="inline-start" />
            {copied ? "Copied" : "Copy token"}
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={onDismiss}>
            I&apos;ve saved it
          </Button>
        </div>
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

/** Renders the iPhone Wallet setup steps required for the integration. */
function IPhoneWalletInstructions() {
  return (
    <div className="flex flex-col gap-3 border-t border-border/80 pt-5">
      <div className="flex items-start gap-2">
        <Smartphone className="mt-0.5 size-4 shrink-0 text-primary" />
        <div>
          <h3 className="font-display text-base font-semibold tracking-tight">
            Set up an iPhone Wallet automation
          </h3>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            Use Apple Shortcuts to send Wallet payments to Ledgerly as expenses. This is a Wallet
            automation, not bank-account synchronization.
          </p>
        </div>
      </div>
      <ol className="flex list-decimal flex-col gap-2 pl-5 text-sm leading-6 text-muted-foreground marker:text-foreground">
        <li>
          In Ledgerly, open <strong className="font-medium text-foreground">Settings → Advanced</strong>,
          generate the personal API token and copy it. The full token is shown only once and must
          be treated like a password.
        </li>
        <li>
          On iPhone, open <strong className="font-medium text-foreground">Shortcuts → Automation → + → Transaction</strong>.
        </li>
        <li>
          Select the Wallet card(s) that should trigger the automation and choose <strong className="font-medium text-foreground">Run Immediately</strong>.
        </li>
        <li>
          Create a blank automation and add <strong className="font-medium text-foreground">Get Contents of URL</strong>{" "}
          (<span className="text-foreground">Ottieni contenuti dell&apos;URL</span>).
        </li>
        <li>
          Set the URL to the Ledgerly backend integration endpoint, for example{" "}
          <code className="break-all rounded bg-muted px-1 py-0.5 font-mono text-xs text-foreground">
            https://&lt;ledgerly-backend&gt;/api/integrations/transactions
          </code>
          .
        </li>
        <li>
          Use method <code className="font-mono text-xs text-foreground">POST</code> and add:
          <ul className="mt-1 flex list-disc flex-col gap-1 pl-5">
            <li>
              <code className="font-mono text-xs text-foreground">Authorization: Bearer &lt;personal-token&gt;</code>
            </li>
            <li>
              <code className="font-mono text-xs text-foreground">Content-Type: application/json</code>
            </li>
          </ul>
        </li>
        <li>
          Build the JSON body from the transaction automation input:
          <ul className="mt-1 flex list-disc flex-col gap-1 pl-5">
            <li><code className="font-mono text-xs text-foreground">amount</code>: Wallet transaction <strong className="font-medium text-foreground">Amount</strong>.</li>
            <li><code className="font-mono text-xs text-foreground">date</code>: current date formatted as <code className="font-mono text-xs text-foreground">yyyy-MM-dd</code>.</li>
            <li><code className="font-mono text-xs text-foreground">direction</code>: fixed value <code className="font-mono text-xs text-foreground">EXPENSE</code>.</li>
            <li><code className="font-mono text-xs text-foreground">note</code>: Wallet transaction <strong className="font-medium text-foreground">Merchant</strong>.</li>
          </ul>
        </li>
        <li>Save the automation and verify the next Wallet payment appears in Ledgerly.</li>
        <li>
          This is an iPhone Wallet automation, <strong className="font-medium text-foreground">not bank-account synchronization</strong>.
          The Ledgerly backend must be reachable from the iPhone, and the amount authorized in
          Wallet can in some cases differ from the final amount posted by the card issuer.
        </li>
        <li>
          If the token is ever exposed, regenerate it in Ledgerly and replace it in Shortcuts.
        </li>
      </ol>
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
        <IPhoneWalletInstructions />
      </CardContent>
    </Card>
  );
}
