"use client";

import { useState } from "react";
import { toast } from "sonner";
import { ChevronDown, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import {
  useCronJobs,
  useCronRuns,
  useRunCronJob,
  type CronJob,
  type CronRun,
} from "@/hooks/use-cron";
import { formatDateTime, formatDuration } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Maps a cron run status to the badge variant used in the UI. */
function statusVariant(status: string): "default" | "secondary" | "destructive" {
  if (status === "SUCCESS") return "default";
  if (status === "FAILED") return "destructive";
  return "secondary";
}

/** Renders one expandable cron run with execution metadata and log output. */
function RunRow({ run }: { run: CronRun }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-md border">
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
        className="flex cursor-pointer items-center gap-3 px-3 py-2 text-sm"
      >
        <ChevronDown
          className={cn(
            "size-3.5 shrink-0 text-muted-foreground transition-transform",
            open && "rotate-180",
          )}
        />
        <Badge variant={statusVariant(run.status)}>{run.status}</Badge>
        <Badge variant="secondary">{run.triggeredBy}</Badge>
        <span className="ml-auto font-mono text-xs text-muted-foreground tabular-nums">
          {formatDateTime(run.startedAt)}
        </span>
      </div>
      {open ? (
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 border-t px-4 py-3 text-xs">
          <dt className="text-muted-foreground">Items processed</dt>
          <dd className="font-mono tabular-nums">{run.itemsProcessed}</dd>
          <dt className="text-muted-foreground">Attempts</dt>
          <dd className="font-mono tabular-nums">{run.attempts}</dd>
          <dt className="text-muted-foreground">Duration</dt>
          <dd className="font-mono tabular-nums">
            {formatDuration(run.startedAt, run.finishedAt)}
          </dd>
          <dt className="text-muted-foreground">Started</dt>
          <dd className="font-mono tabular-nums">{formatDateTime(run.startedAt)}</dd>
          <dt className="text-muted-foreground">Finished</dt>
          <dd className="font-mono tabular-nums">
            {run.finishedAt ? formatDateTime(run.finishedAt) : "—"}
          </dd>
          {run.error ? (
            <>
              <dt className="text-muted-foreground">Error</dt>
              <dd className="font-mono text-destructive-ink">{run.error}</dd>
            </>
          ) : null}
          {run.log ? (
            <>
              <dt className="col-span-2 mt-1 text-muted-foreground">Log</dt>
              <dd className="col-span-2">
                <pre className="overflow-x-auto whitespace-pre-wrap rounded-md bg-muted p-2.5 font-mono text-[11px] leading-relaxed">
                  {run.log}
                </pre>
              </dd>
            </>
          ) : null}
        </dl>
      ) : null}
    </div>
  );
}

/** Renders one scheduled job with its latest status and expandable run history. */
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
        <div className="flex flex-col gap-2 border-t px-4 py-3">
          {isLoadingRuns ? (
            <span className="text-sm text-muted-foreground">Loading runs…</span>
          ) : runs.length === 0 ? (
            <span className="text-sm text-muted-foreground">No runs yet.</span>
          ) : (
            runs.map((r) => <RunRow key={r.id} run={r} />)
          )}
        </div>
      ) : null}
    </div>
  );
}

/** Renders scheduled jobs and manual run controls for the developer page. */
export function CronSection() {
  const jobs = useCronJobs();
  const runs = useCronRuns(100);
  const runJob = useRunCronJob();

  /** Starts a manual cron job run and reports the result via toast. */
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
