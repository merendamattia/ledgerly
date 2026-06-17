"use client";

import { useState } from "react";
import { toast } from "sonner";
import { ChevronDown, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { DataTable, type Column } from "@/components/data-table";
import {
  useCronJobs,
  useCronRuns,
  useRunCronJob,
  type CronJob,
  type CronRun,
} from "@/hooks/use-cron";
import { formatDateTime, formatDuration } from "@/lib/format";
import { cn } from "@/lib/utils";

function statusVariant(status: string): "default" | "secondary" | "destructive" {
  if (status === "SUCCESS") return "default";
  if (status === "FAILED") return "destructive";
  return "secondary";
}

const runColumns: Column<CronRun>[] = [
  {
    header: "Status",
    cell: (r) => <Badge variant={statusVariant(r.status)}>{r.status}</Badge>,
  },
  { header: "Trigger", cell: (r) => <Badge variant="secondary">{r.triggeredBy}</Badge> },
  {
    header: "Items",
    align: "right",
    cell: (r) => <span className="font-mono tabular-nums">{r.itemsProcessed}</span>,
  },
  {
    header: "Duration",
    align: "right",
    cell: (r) => (
      <span className="font-mono tabular-nums">{formatDuration(r.startedAt, r.finishedAt)}</span>
    ),
  },
  { header: "Started", cell: (r) => formatDateTime(r.startedAt) },
  { header: "Finished", cell: (r) => (r.finishedAt ? formatDateTime(r.finishedAt) : "—") },
];

function JobRow({
  job,
  runs,
  isLoadingRuns,
  onRun,
  isRunning,
}: {
  job: CronJob;
  runs: CronRun[];
  isLoadingRuns: boolean;
  onRun: (key: string) => void;
  isRunning: boolean;
}) {
  const [open, setOpen] = useState(false);
  const lastRun = runs[0];

  return (
    <div className="rounded-lg border shadow-card">
      <div
        role="button"
        tabIndex={0}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setOpen((v) => !v);
          }
        }}
        className="flex w-full cursor-pointer items-center gap-3 px-4 py-3 text-left"
      >
        <ChevronDown
          className={cn("size-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")}
        />
        <div className="flex min-w-0 flex-col">
          <span className="font-display font-semibold">{job.name}</span>
          <span className="font-mono text-xs text-muted-foreground tabular-nums">
            {job.schedule ? `cron: ${job.schedule}` : "manual"}
          </span>
        </div>
        <div className="ml-auto flex items-center gap-3">
          {lastRun ? (
            <div className="hidden items-center gap-2 sm:flex">
              <Badge variant={statusVariant(lastRun.status)}>{lastRun.status}</Badge>
              <span className="text-xs text-muted-foreground">
                {formatDateTime(lastRun.startedAt)}
              </span>
            </div>
          ) : (
            <span className="text-xs text-muted-foreground">Never run</span>
          )}
          {job.runnable ? (
            <Button
              size="sm"
              variant="outline"
              onClick={(e) => {
                e.stopPropagation();
                onRun(job.key);
              }}
              disabled={isRunning}
            >
              {isRunning ? (
                <Spinner data-icon="inline-start" />
              ) : (
                <RefreshCw data-icon="inline-start" />
              )}
              Run now
            </Button>
          ) : null}
        </div>
      </div>
      {open ? (
        <div className="border-t px-4 py-3">
          <DataTable
            columns={runColumns}
            data={runs}
            getRowKey={(r) => r.id}
            isLoading={isLoadingRuns}
            emptyState={<span className="text-sm text-muted-foreground">No runs yet.</span>}
          />
        </div>
      ) : null}
    </div>
  );
}

export function CronSection() {
  const jobs = useCronJobs();
  const runs = useCronRuns(100);
  const runJob = useRunCronJob();

  function handleRun(key: string) {
    runJob.mutate(key, {
      onSuccess: (run) => toast.success(`Job finished: ${run.status}`),
      onError: (e) => toast.error(e.message),
    });
  }

  const runsByJob = new Map<string, CronRun[]>();
  for (const run of runs.data ?? []) {
    const list = runsByJob.get(run.jobId) ?? [];
    list.push(run);
    runsByJob.set(run.jobId, list);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Scheduled jobs</CardTitle>
        <CardDescription>Background jobs and their run history. Expand a job for details.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {jobs.data?.map((job) => (
          <JobRow
            key={job.id}
            job={job}
            runs={runsByJob.get(job.id) ?? []}
            isLoadingRuns={runs.isLoading}
            onRun={handleRun}
            isRunning={runJob.isPending && runJob.variables === job.key}
          />
        ))}
      </CardContent>
    </Card>
  );
}
