"use client";

import { PageHeader } from "@/components/page-header";
import { CronSection } from "@/components/cron-section";
import { AdminGuard } from "@/components/admin-guard";

/** Renders developer-only scheduled job controls and run history. */
export default function DevPage() {
  return (
    <AdminGuard>
      <div className="flex flex-col gap-6">
        <PageHeader
          title="Dev"
          description="Scheduled jobs and background tasks — price updates, backfill and their run history."
        />
        <CronSection />
      </div>
    </AdminGuard>
  );
}
