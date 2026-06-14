"use client";

import { toast } from "sonner";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { DataTable, type Column } from "@/components/data-table";
import { useCronJobs, useCronRuns, useRunCronJob, type CronRun } from "@/hooks/use-cron";
import { formatDateTime } from "@/lib/format";

const RUNNABLE = new Set(["nightly-prices"]);

function statusVariant(status: string): "default" | "secondary" | "destructive" {
  if (status === "SUCCESS") return "default";
  if (status === "FAILED") return "destructive";
  return "secondary";
}

export function CronSection() {
  const jobs = useCronJobs();
  const runs = useCronRuns(15);
  const runJob = useRunCronJob();

  function handleRun(key: string) {
    runJob.mutate(key, {
      onSuccess: (run) => toast.success(`Job finished: ${run.status}`),
      onError: (e) => toast.error(e.message),
    });
  }

  const columns: Column<CronRun>[] = [
    { header: "Job", cell: (r) => r.job?.name ?? r.jobId },
    {
      header: "Status",
      cell: (r) => <Badge variant={statusVariant(r.status)}>{r.status}</Badge>,
    },
    { header: "Trigger", cell: (r) => <Badge variant="secondary">{r.triggeredBy}</Badge> },
    { header: "Items", align: "right", cell: (r) => r.itemsProcessed },
    { header: "Started", cell: (r) => formatDateTime(r.startedAt) },
    {
      header: "Finished",
      cell: (r) => (r.finishedAt ? formatDateTime(r.finishedAt) : "—"),
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Scheduled jobs</CardTitle>
        <CardDescription>Background price updates and their run history.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-wrap gap-2">
          {jobs.data?.map((job) => (
            <div
              key={job.id}
              className="flex items-center gap-3 rounded-md border px-3 py-2 text-sm"
            >
              <div className="flex flex-col">
                <span className="font-medium">{job.name}</span>
                <span className="text-muted-foreground">
                  {job.schedule ? `cron: ${job.schedule}` : "manual"}
                </span>
              </div>
              {RUNNABLE.has(job.key) ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleRun(job.key)}
                  disabled={runJob.isPending}
                >
                  {runJob.isPending && runJob.variables === job.key ? (
                    <Spinner data-icon="inline-start" />
                  ) : (
                    <RefreshCw data-icon="inline-start" />
                  )}
                  Run now
                </Button>
              ) : null}
            </div>
          ))}
        </div>
        <DataTable
          columns={columns}
          data={runs.data}
          getRowKey={(r) => r.id}
          isLoading={runs.isLoading}
          emptyState={<span className="text-sm text-muted-foreground">No runs yet.</span>}
        />
      </CardContent>
    </Card>
  );
}
