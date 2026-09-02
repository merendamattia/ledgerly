"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { signIn } from "@/lib/auth-client";
import { AppLogo } from "@/components/app-logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";

/** Renders the email/password login page. */
export default function LoginPage() {
  const t = useTranslations("auth");
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);

  /** Authenticates the user and redirects to the app on success. */
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    const { error } = await signIn.email({ email, password });
    setPending(false);
    if (error) {
      toast.error(error.message ?? t("invalidCredentials"));
      return;
    }
    router.replace("/");
  }

  return (
    <main className="relative flex min-h-svh items-center overflow-hidden p-3 sm:p-6 lg:p-10">
      <div className="pointer-events-none absolute -top-40 -right-32 size-[34rem] rounded-full bg-primary/25 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-48 -left-32 size-[30rem] rounded-full bg-positive/15 blur-3xl" />

      <section className="relative mx-auto grid w-full max-w-6xl overflow-hidden rounded-2xl border border-white/80 bg-card/70 shadow-card backdrop-blur-xl md:min-h-[680px] md:grid-cols-[1.15fr_0.85fr]">
        <div className="hidden flex-col justify-between border-r border-border/70 p-10 md:flex lg:p-14">
          <AppLogo />
          <div className="max-w-lg">
            <h1 className="max-w-md font-display text-5xl leading-[1.02] font-semibold tracking-[-0.035em] text-balance">
              {t("heroTitle")}
            </h1>
            <p className="mt-5 max-w-md text-base leading-relaxed text-muted-foreground text-pretty">
              {t("heroDescription")}
            </p>
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm font-medium text-muted-foreground">
            <span>{t("selfHosted")}</span>
            <span>{t("adminManaged")}</span>
            <span>{t("privateByDesign")}</span>
          </div>
        </div>

        <div className="flex min-h-[calc(100svh-1.5rem)] flex-col justify-center p-4 sm:p-8 md:min-h-0 lg:p-12">
          <AppLogo className="mb-10 md:hidden" />
          <Card className="w-full border-border/70 bg-card shadow-none">
            <CardHeader>
              <CardTitle className="text-2xl">{t("welcomeBack")}</CardTitle>
              <CardDescription>{t("signInDescription")}</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit}>
                <FieldGroup>
                  <Field>
                    <FieldLabel htmlFor="email">{t("email")}</FieldLabel>
                    <Input
                      id="email"
                      type="email"
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="password">{t("password")}</FieldLabel>
                    <Input
                      id="password"
                      type="password"
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                  </Field>
                  <Button type="submit" size="lg" disabled={pending} className="w-full">
                    {pending ? <Spinner data-icon="inline-start" /> : null}
                    {t("signIn")}
                  </Button>
                </FieldGroup>
              </form>
            </CardContent>
          </Card>
        </div>
      </section>
    </main>
  );
}
