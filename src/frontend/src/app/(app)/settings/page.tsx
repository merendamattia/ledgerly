"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2, Pencil } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useSettings, useUpdateSettings } from "@/hooks/use-settings";
import {
  useCategories,
  useCreateCategory,
  useUpdateCategory,
  useDeleteCategory,
  type Category,
} from "@/hooks/use-categories";

function BaseCurrencyCard() {
  const settings = useSettings();
  const update = useUpdateSettings();

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const currency = String(form.get("currency") ?? "").toUpperCase();
    update.mutate(
      { baseCurrency: currency },
      {
        onSuccess: () => toast.success("Base currency updated"),
        onError: (err) => toast.error(err.message),
      },
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Base currency</CardTitle>
        <CardDescription>All values are converted to this currency.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="flex items-end gap-3">
          <Field className="w-40">
            <FieldLabel htmlFor="currency">Currency</FieldLabel>
            {/* Uncontrolled input reset via `key` once settings load. */}
            <Input
              id="currency"
              name="currency"
              key={settings.data?.baseCurrency ?? "EUR"}
              defaultValue={settings.data?.baseCurrency ?? "EUR"}
              maxLength={3}
            />
          </Field>
          <Button type="submit" disabled={update.isPending}>
            Save
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function EditCategoryDialog({ category }: { category: Category }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(category.name);
  const [color, setColor] = useState(category.color ?? "#64748b");
  const update = useUpdateCategory();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    update.mutate(
      { id: category.id, name, color },
      {
        onSuccess: () => {
          toast.success("Category updated");
          setOpen(false);
        },
        onError: (err) => toast.error(err.message),
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={<Button variant="ghost" size="icon" className="size-4" />}
        aria-label="Edit category"
      >
        <Pencil />
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit category</DialogTitle>
          <DialogDescription>Rename or recolour this category.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit}>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="edit-cat-name">Name</FieldLabel>
              <Input
                id="edit-cat-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="edit-cat-color">Color</FieldLabel>
              <Input
                id="edit-cat-color"
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="h-9 w-16 p-1"
              />
            </Field>
            <DialogFooter>
              <Button type="submit" disabled={update.isPending}>
                Save
              </Button>
            </DialogFooter>
          </FieldGroup>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function CategoriesCard() {
  const categories = useCategories();
  const create = useCreateCategory();
  const del = useDeleteCategory();
  const [name, setName] = useState("");
  const [kind, setKind] = useState<"INCOME" | "EXPENSE">("EXPENSE");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    create.mutate(
      { name, kind, color: null },
      {
        onSuccess: () => {
          toast.success("Category added");
          setName("");
        },
        onError: (err) => toast.error(err.message),
      },
    );
  }

  const expense = categories.data?.filter((c) => c.kind === "EXPENSE") ?? [];
  const income = categories.data?.filter((c) => c.kind === "INCOME") ?? [];

  function CategoryChip({ category }: { category: Category }) {
    return (
      <Badge
        variant="secondary"
        className="gap-1.5 py-1 pr-1"
        style={
          category.color
            ? { backgroundColor: `${category.color}1f`, color: category.color }
            : undefined
        }
      >
        {category.name}
        <EditCategoryDialog category={category} />
        <ConfirmDialog
          title="Delete category?"
          description={`Remove "${category.name}". Existing transactions keep their data.`}
          confirmLabel="Delete"
          onConfirm={() =>
            del.mutate(category.id, {
              onSuccess: () => toast.success("Category deleted"),
              onError: (e) => toast.error(e.message),
            })
          }
          trigger={
            <Button variant="ghost" size="icon" className="size-4">
              <Trash2 />
            </Button>
          }
        />
      </Badge>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Categories</CardTitle>
        <CardDescription>Manage your income and expense categories.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <form onSubmit={submit} className="flex flex-wrap items-end gap-3">
          <Field className="w-56">
            <FieldLabel htmlFor="cat-name">Name</FieldLabel>
            <Input id="cat-name" value={name} onChange={(e) => setName(e.target.value)} required />
          </Field>
          <Field className="w-40">
            <FieldLabel htmlFor="cat-kind">Kind</FieldLabel>
            <Select value={kind} onValueChange={(v) => setKind((v ?? "EXPENSE") as typeof kind)}>
              <SelectTrigger id="cat-kind">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="EXPENSE">Expense</SelectItem>
                <SelectItem value="INCOME">Income</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Button type="submit" disabled={create.isPending}>
            <Plus data-icon="inline-start" />
            Add
          </Button>
        </form>

        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium">Expense</span>
          <div className="flex flex-wrap gap-2">
            {expense.map((c) => (
              <CategoryChip key={c.id} category={c} />
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium">Income</span>
          <div className="flex flex-wrap gap-2">
            {income.map((c) => (
              <CategoryChip key={c.id} category={c} />
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function SettingsPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Settings" description="Base currency and categories." />
      <BaseCurrencyCard />
      <CategoriesCard />
    </div>
  );
}
