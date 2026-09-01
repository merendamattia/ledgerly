"use client";

import { PageHeader } from "@/components/page-header";
import { CronSection } from "@/components/cron-section";
import { AdminGuard } from "@/components/admin-guard";
import { useTranslations } from "next-intl";

/** Renders developer-only scheduled job controls and run history. */
export default function DevPage() {
  const t = useTranslations("devPage");
  return (
    <AdminGuard>
      <div className="flex flex-col gap-6">
        <PageHeader
          title={t("title")}
          description={t("description")}
        />
        <CronSection />
      </div>
    </AdminGuard>
  );
}
