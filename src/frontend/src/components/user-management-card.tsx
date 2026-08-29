"use client";

import { useState } from "react";
import { toast } from "sonner";
import { UserPlus } from "lucide-react";
import { useCreateUser, useUsers } from "@/hooks/use-users";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";

/** Renders admin-managed member provisioning and the account directory. */
export function UserManagementCard() {
  const users = useUsers();
  const createUser = useCreateUser();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    createUser.mutate(
      { email, name: name || undefined, password },
      {
        onSuccess: () => {
          setEmail("");
          setName("");
          setPassword("");
          toast.success("User created");
        },
        onError: (requestError) => setError(requestError.message),
      },
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserPlus className="size-4 text-primary" />
          Users
        </CardTitle>
        <CardDescription>
          Create members with a temporary password. They must replace it before using Ledgerly.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <form onSubmit={submit} className="max-w-3xl">
          <FieldGroup className="grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_auto]">
            <Field className="min-w-0">
              <FieldLabel htmlFor="new-user-email">Email</FieldLabel>
              <Input
                id="new-user-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </Field>
            <Field className="min-w-0">
              <FieldLabel htmlFor="new-user-name">Name</FieldLabel>
              <Input
                id="new-user-name"
                autoComplete="name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Optional"
              />
            </Field>
            <Field className="min-w-0">
              <FieldLabel htmlFor="temporary-password">Temporary password</FieldLabel>
              <Input
                id="temporary-password"
                type="password"
                autoComplete="new-password"
                minLength={8}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
            </Field>
            <Button type="submit" disabled={createUser.isPending} className="w-full sm:w-fit">
              {createUser.isPending ? <Spinner data-icon="inline-start" /> : <UserPlus data-icon="inline-start" />}
              Create user
            </Button>
          </FieldGroup>
          <FieldError>{error}</FieldError>
        </form>
        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
        <div className="overflow-x-auto rounded-lg border border-border/80">
          <div className="min-w-[32rem] divide-y divide-border/70">
            {(users.data ?? []).map((user) => (
              <div key={user.id} className="flex items-center justify-between gap-4 px-3 py-3 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-medium">{user.name}</p>
                  <p className="truncate text-muted-foreground">{user.email}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Badge variant={user.role === "admin" ? "default" : "secondary"}>{user.role}</Badge>
                  {user.mustChangePassword ? <Badge variant="outline">Password change required</Badge> : null}
                </div>
              </div>
            ))}
            {users.isLoading ? (
              <div className="flex items-center gap-2 px-3 py-4 text-sm text-muted-foreground">
                <Spinner /> Loading users…
              </div>
            ) : null}
            {!users.isLoading && (users.data ?? []).length === 0 ? (
              <p className="px-3 py-4 text-sm text-muted-foreground">No users found.</p>
            ) : null}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
