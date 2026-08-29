"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AppLogo } from "@/components/app-logo";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { authClient, useSession } from "@/lib/auth-client";
import { useChangePassword } from "@/hooks/use-users";

/** Forces temporary-password accounts through the first credential change. */
export default function ChangePasswordPage() {
  const router = useRouter();
  const { data: session, isPending } = useSession();
  const changePassword = useChangePassword();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isPending && !session) router.replace("/login");
    if (!isPending && session && !session.user.mustChangePassword) router.replace("/");
  }, [isPending, router, session]);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (newPassword !== confirmation) {
      setError("New passwords do not match");
      return;
    }
    changePassword.mutate(
      { currentPassword, newPassword, confirmation },
      {
        onSuccess: async () => {
          await authClient.getSession();
          toast.success("Password updated");
          router.replace("/");
        },
        onError: (requestError) => setError(requestError.message),
      },
    );
  }

  if (isPending || !session || !session.user.mustChangePassword) {
    return (
      <main className="flex min-h-svh items-center justify-center p-4">
        <Spinner className="size-6" />
      </main>
    );
  }

  return (
    <main className="relative flex min-h-svh items-center justify-center overflow-hidden p-4 sm:p-8">
      <div className="pointer-events-none absolute -top-40 -right-32 size-[34rem] rounded-full bg-primary/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-48 -left-32 size-[30rem] rounded-full bg-positive/15 blur-3xl" />
      <section className="relative w-full max-w-lg">
        <AppLogo className="mb-8" label="Account security" />
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Choose a new password</CardTitle>
            <CardDescription>
              This temporary password can only be used once. Set a new one to continue.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit}>
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="temporary-current-password">Temporary password</FieldLabel>
                  <Input
                    id="temporary-current-password"
                    type="password"
                    autoComplete="current-password"
                    value={currentPassword}
                    onChange={(event) => setCurrentPassword(event.target.value)}
                    required
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="first-new-password">New password</FieldLabel>
                  <Input
                    id="first-new-password"
                    type="password"
                    autoComplete="new-password"
                    minLength={8}
                    value={newPassword}
                    onChange={(event) => setNewPassword(event.target.value)}
                    required
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="first-confirm-password">Confirm new password</FieldLabel>
                  <Input
                    id="first-confirm-password"
                    type="password"
                    autoComplete="new-password"
                    minLength={8}
                    value={confirmation}
                    onChange={(event) => setConfirmation(event.target.value)}
                    required
                  />
                  <FieldError>{error}</FieldError>
                </Field>
                {error ? (
                  <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                ) : null}
                <Button type="submit" size="lg" disabled={changePassword.isPending} className="w-full">
                  {changePassword.isPending ? <Spinner data-icon="inline-start" /> : null}
                  Set password and continue
                </Button>
              </FieldGroup>
            </form>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
