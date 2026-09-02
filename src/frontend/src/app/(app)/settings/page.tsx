"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Plus, Trash2, Pencil } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmojiPickerField } from "@/components/emoji-picker-field";
import { CategoryIcon, emojiFor } from "@/components/category-badge";
import { cn } from "@/lib/utils";
import { useSettings, useUpdateSettings } from "@/hooks/use-settings";
import { useSession } from "@/lib/auth-client";
import { AccountSecurityCard } from "@/components/account-security-card";
import { UserManagementCard } from "@/components/user-management-card";
import { AdvancedSettingsCard } from "@/components/advanced-settings-card";
import {
  useCategories,
  useCreateCategory,
  useUpdateCategory,
  useDeleteCategory,
  type Category,
} from "@/hooks/use-categories";

/** Renders the base-currency selector used for all converted values. */
function BaseCurrencyCard() {
  const t = useTranslations("settings");
  const settings = useSettings();
  const update = useUpdateSettings();
  const current = settings.data?.baseCurrency ?? "EUR";
  const currencies = [
    { value: "EUR", label: t("euro") },
    { value: "USD", label: t("usDollar") },
  ];

  /** Persists a base-currency change unless the selected value is already active. */
  function updateCurrency(currency: string) {
    if (currency === current) return;
    update.mutate(
      { baseCurrency: currency },
      {
        onSuccess: () => toast.success(t("baseCurrencyUpdated")),
        onError: (err) => toast.error(err.message),
      },
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("baseCurrencyTitle")}</CardTitle>
        <CardDescription>{t("baseCurrencyDescription")}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="inline-grid grid-cols-2 gap-0.5 rounded-lg bg-muted p-0.5">
          {currencies.map((currency) => {
            const active = current === currency.value;
            return (
              <button
                key={currency.value}
                type="button"
                onClick={() => updateCurrency(currency.value)}
                disabled={update.isPending}
                className={cn(
                  "rounded-md px-3 py-1.5 text-left text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60",
                  active
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <span className="block font-mono text-[11px] font-semibold tabular-nums">
                  {currency.value}
                </span>
                <span className="block">{currency.label}</span>
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

/** Persists and immediately applies the current user's UI language. */
function LanguageCard() {
  const t = useTranslations("settings");
  const common = useTranslations("common");
  const settings = useSettings();
  const update = useUpdateSettings();
  const current = settings.data?.locale ?? "en";
  const items = { en: common("english"), it: common("italian") };

  function updateLanguage(locale: "en" | "it") {
    if (locale === current) return;
    update.mutate(
      { locale },
      {
        onSuccess: () => toast.success(t("languageUpdated")),
        onError: (error) => toast.error(error.message),
      },
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("languageTitle")}</CardTitle>
        <CardDescription>{t("languageDescription")}</CardDescription>
      </CardHeader>
      <CardContent>
        <Select
          value={current}
          items={items}
          onValueChange={(value) => {
            if (value === "en" || value === "it") updateLanguage(value);
          }}
          disabled={update.isPending}
        >
          <SelectTrigger className="w-full sm:w-64" aria-label={t("languageTitle")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem value="en">{common("english")}</SelectItem>
              <SelectItem value="it">{common("italian")}</SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
      </CardContent>
    </Card>
  );
}

/** Renders the edit dialog for renaming a category and changing its emoji. */
function EditCategoryDialog({ category }: { category: Category }) {
  const t = useTranslations("settings");
  const common = useTranslations("common");
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(category.name);
  const [emoji, setEmoji] = useState(category.emoji ?? emojiFor(category.name));
  const update = useUpdateCategory();

  /** Submits the edited category fields to the API. */
  function submit(e: React.FormEvent) {
    e.preventDefault();
    update.mutate(
      { id: category.id, name, emoji },
      {
        onSuccess: () => {
          toast.success(t("categoryUpdated"));
          setOpen(false);
        },
        onError: (err) => toast.error(err.message),
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={<Button variant="ghost" size="icon-sm" />}
        aria-label={t("editCategory")}
      >
        <Pencil />
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("editCategory")}</DialogTitle>
          <DialogDescription>{t("renameCategory")}</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit}>
          <FieldGroup>
            <Field>
              <FieldLabel>{t("emoji")}</FieldLabel>
              <EmojiPickerField value={emoji} onChange={setEmoji} />
            </Field>
            <Field>
              <FieldLabel htmlFor="edit-cat-name">{t("name")}</FieldLabel>
              <Input
                id="edit-cat-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </Field>
            <DialogFooter>
              <Button type="submit" disabled={update.isPending}>
                {common("save")}
              </Button>
            </DialogFooter>
          </FieldGroup>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Renders one category row with edit and delete actions. */
function CategoryRow({ category }: { category: Category }) {
  const t = useTranslations("settings");
  const common = useTranslations("common");
  const del = useDeleteCategory();
  return (
    <div className="flex items-center justify-between gap-1 rounded-lg border bg-card px-3 py-2">
      <div className="flex min-w-0 items-center gap-2">
        <CategoryIcon name={category.name} emoji={category.emoji} className="size-7" />
        <span className="min-w-0 truncate text-sm font-medium">{category.name}</span>
      </div>
      <div className="flex shrink-0 items-center">
        <EditCategoryDialog category={category} />
        <ConfirmDialog
          title={t("deleteCategoryTitle")}
          description={t("deleteCategoryDescription", { name: category.name })}
          confirmLabel={common("delete")}
          onConfirm={() =>
            del.mutate(category.id, {
              onSuccess: () => toast.success(t("categoryDeleted")),
              onError: (e) => toast.error(e.message),
            })
          }
          trigger={
            <Button variant="ghost" size="icon-sm" aria-label={t("deleteCategoryAria")}>
              <Trash2 />
            </Button>
          }
        />
      </div>
    </div>
  );
}

/** Renders a responsive category grid or an empty state. */
function CategoryList({ items }: { items: Category[] }) {
  const t = useTranslations("settings");
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">{t("noCategories")}</p>;
  }
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5">
      {items.map((c) => (
        <CategoryRow key={c.id} category={c} />
      ))}
    </div>
  );
}

/** Renders category creation and management controls. */
function CategoriesCard() {
  const t = useTranslations("settings");
  const categories = useCategories();
  const create = useCreateCategory();
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState("");
  const [kind, setKind] = useState<"INCOME" | "EXPENSE">("EXPENSE");

  /** Creates a new category from the inline form. */
  function submit(e: React.FormEvent) {
    e.preventDefault();
    create.mutate(
      { name, kind, emoji: emoji || emojiFor(name) },
      {
        onSuccess: () => {
          toast.success(t("categoryAdded"));
          setName("");
          setEmoji("");
        },
        onError: (err) => toast.error(err.message),
      },
    );
  }

  const byName = (a: Category, b: Category) => a.name.localeCompare(b.name);
  const expense = (categories.data ?? []).filter((c) => c.kind === "EXPENSE").sort(byName);
  const income = (categories.data ?? []).filter((c) => c.kind === "INCOME").sort(byName);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("categoriesTitle")}</CardTitle>
        <CardDescription>{t("categoriesDescription")}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <form onSubmit={submit}>
          <FieldGroup className="grid items-end gap-3 sm:grid-cols-[auto_minmax(12rem,1fr)_10rem_auto]">
            <Field className="w-fit">
              <FieldLabel>{t("emoji")}</FieldLabel>
              <EmojiPickerField value={emoji || emojiFor(name)} onChange={setEmoji} />
            </Field>
            <Field className="min-w-0">
              <FieldLabel htmlFor="cat-name">{t("name")}</FieldLabel>
              <Input id="cat-name" value={name} onChange={(e) => setName(e.target.value)} required />
            </Field>
            <Field className="min-w-0">
              <FieldLabel htmlFor="cat-kind">{t("kind")}</FieldLabel>
              <Select
                value={kind}
                items={{ EXPENSE: t("expense"), INCOME: t("income") }}
                onValueChange={(v) => setKind((v ?? "EXPENSE") as typeof kind)}
              >
                <SelectTrigger id="cat-kind">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="EXPENSE">{t("expense")}</SelectItem>
                    <SelectItem value="INCOME">{t("income")}</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
            <Button type="submit" disabled={create.isPending} className="w-full sm:w-auto">
              <Plus data-icon="inline-start" />
              {t("add")}
            </Button>
          </FieldGroup>
        </form>

        <div className="flex flex-col gap-2.5">
          <span className="text-sm font-medium">{t("expense")}</span>
          <CategoryList items={expense} />
        </div>
        <div className="flex flex-col gap-2.5">
          <span className="text-sm font-medium">{t("income")}</span>
          <CategoryList items={income} />
        </div>
      </CardContent>
    </Card>
  );
}

/** Renders base-currency and category settings. */
export default function SettingsPage() {
  const t = useTranslations("settings");
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("title")} description={t("description")} />
      <LanguageCard />
      <BaseCurrencyCard />
      <CategoriesCard />
      <AccountSecurityCard />
      <AdvancedSettingsCard />
      <AdminSettingsSection />
    </div>
  );
}

/** Renders account-management controls only for administrators. */
function AdminSettingsSection() {
  const { data: session } = useSession();
  return session?.user.role === "admin" ? <UserManagementCard /> : null;
}
