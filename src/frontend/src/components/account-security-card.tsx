"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { KeyRound } from "lucide-react";
import { useChangePassword } from "@/hooks/use-users";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";

/** Renders the credential-change form shared by administrators and members. */
export function AccountSecurityCard() {
  const t = useTranslations("security");
  const changePassword = useChangePassword();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setValidationError(null);
    if (newPassword !== confirmation) {
      setValidationError(t("passwordMismatch"));
      return;
    }
    changePassword.mutate(
      { currentPassword, newPassword, confirmation },
      {
        onSuccess: () => {
          setCurrentPassword("");
          setNewPassword("");
          setConfirmation("");
          toast.success(t("passwordChanged"));
        },
        onError: (error) => setValidationError(error.message),
      },
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <KeyRound className="size-4 text-primary" />
          {t("title")}
        </CardTitle>
        <CardDescription>{t("description")}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="max-w-xl">
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="current-password">{t("currentPassword")}</FieldLabel>
              <Input
                id="current-password"
                type="password"
                autoComplete="current-password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                required
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="new-password">{t("newPassword")}</FieldLabel>
              <Input
                id="new-password"
                type="password"
                autoComplete="new-password"
                minLength={8}
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                required
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="confirm-password">{t("confirmPassword")}</FieldLabel>
              <Input
                id="confirm-password"
                type="password"
                autoComplete="new-password"
                minLength={8}
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
                required
              />
              <FieldError>{validationError}</FieldError>
            </Field>
            {validationError ? (
              <Alert variant="destructive">
                <AlertDescription>{validationError}</AlertDescription>
              </Alert>
            ) : null}
            <Button type="submit" disabled={changePassword.isPending} className="w-fit">
              {changePassword.isPending ? <Spinner data-icon="inline-start" /> : null}
              {t("changePassword")}
            </Button>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  );
}
