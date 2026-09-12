"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { ChartNoAxesCombined, RefreshCw, Sparkles, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { ForecastFanChart } from "@/components/charts/forecast-fan-chart";
import { PrivateNumber } from "@/components/private-number";
import { usePrivacyMode } from "@/components/privacy-mode";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useAnalysis, useRefreshAnalysis, type AnalysisData } from "@/hooks/use-analysis";
import {
  HORIZON_OPTIONS,
  buildForecastChartRows,
  sliceForecastSeries,
  visibleAiInterpretation,
  type ForecastChartRow,
} from "@/lib/analysis-view";
import { formatDate, formatDateTime, formatMoney, formatNumber, formatPercent } from "@/lib/format";

type Forecast = NonNullable<AnalysisData["forecast"]>;

function ForecastLoading() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-16 w-full" />
      <Skeleton className="h-[420px] w-full" />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Skeleton className="h-[420px] w-full" />
        <Skeleton className="h-[420px] w-full" />
      </div>
    </div>
  );
}

function ExplanationGrid({ rows }: { rows: { label: string; value: React.ReactNode }[] }) {
  return (
    <dl className="grid grid-cols-1 gap-x-5 gap-y-3 sm:grid-cols-2 xl:grid-cols-4">
      {rows.map((row) => (
        <div key={row.label} className="min-w-0">
          <dt className="text-xs text-muted-foreground">{row.label}</dt>
          <dd className="mt-1 font-mono text-sm font-semibold tabular-nums">{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function ForecastSection({
  title,
  description,
  rows,
  currency,
  labels,
  explanationRows,
  historicalOverlayLabel,
  color,
  className,
  note,
}: {
  title: string;
  description: string;
  rows: ForecastChartRow[];
  currency: string;
  labels: {
    today: string;
    actual: string;
    median: string;
    mean: string;
    range: string;
    interpretation: string;
    aria: string;
  };
  explanationRows: { label: string; value: React.ReactNode }[];
  historicalOverlayLabel?: string;
  color?: string;
  className?: string;
  note?: string;
}) {
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription className="max-w-[72ch]">{description}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <ForecastFanChart
          rows={rows}
          currency={currency}
          todayLabel={labels.today}
          actualLabel={labels.actual}
          medianLabel={labels.median}
          meanLabel={labels.mean}
          historicalOverlayLabel={historicalOverlayLabel}
          rangeLabel={labels.range}
          ariaLabel={labels.aria}
          color={color}
        />
        <Separator />
        <div className="flex flex-col gap-3">
          <h3 className="text-sm font-semibold">{labels.interpretation}</h3>
          <ExplanationGrid rows={explanationRows} />
          {note ? <p className="max-w-[72ch] text-xs leading-relaxed text-muted-foreground">{note}</p> : null}
        </div>
      </CardContent>
    </Card>
  );
}

function AiInterpretation({ data }: { data: AnalysisData }) {
  const t = useTranslations("analysis");
  const { shouldHidePrivateNumbers } = usePrivacyMode();
  const current = data.forecast?.analysis;
  const previous = data.previousAnalysis;
  const interpretation = current?.status === "COMPLETED" ? current.content : previous?.content;
  const content = visibleAiInterpretation(interpretation, shouldHidePrivateNumbers);
  const generationActive =
    data.generation?.status === "PENDING" || data.generation?.status === "RUNNING";
  const showingPrevious =
    (!!content && generationActive) || (current?.status !== "COMPLETED" && !!previous?.content);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Sparkles className="size-4 text-accent-foreground" aria-hidden="true" />
          <CardTitle>{t("aiTitle")}</CardTitle>
        </div>
        {showingPrevious ? <CardDescription>{t("aiPrevious")}</CardDescription> : null}
        {!showingPrevious && (current?.status === "PENDING" || current?.status === "RUNNING") ? (
          <CardDescription>{t("aiPending")}</CardDescription>
        ) : null}
        {current?.status === "FAILED" ? (
          <CardDescription>{t("aiFailed")}</CardDescription>
        ) : null}
      </CardHeader>
      <CardContent>
        {shouldHidePrivateNumbers ? (
          <p className="text-sm text-muted-foreground">{t("aiPrivacyHidden")}</p>
        ) : content ? (
          <div className="flex max-w-[76ch] flex-col gap-4 text-sm leading-relaxed">
            <p>{content.summary}</p>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <p>{content.netWorthAnalysis}</p>
              <p>{content.cashFlowAnalysis}</p>
              <p>{content.investmentAnalysis}</p>
            </div>
            <Separator />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              {[
                [t("keyDrivers"), content.keyDrivers],
                [t("risks"), content.risksAndUncertainty],
                [t("assumptions"), content.assumptions],
              ].map(([heading, items]) => (
                <section key={String(heading)}>
                  <h3 className="mb-2 text-sm font-semibold">{String(heading)}</h3>
                  <ul className="flex list-disc flex-col gap-1 pl-4 text-muted-foreground">
                    {(items as string[]).map((item) => <li key={item}>{item}</li>)}
                  </ul>
                </section>
              ))}
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            {current?.status === "FAILED" ? t("aiFailed") : t("aiUnavailable")}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function qualityLabel(forecast: Forecast, translate: ReturnType<typeof useTranslations<"analysis">>) {
  if (forecast.payload.assumptions.dataQuality === "STANDARD") return translate("qualityStandard");
  if (forecast.payload.assumptions.dataQuality === "REDUCED") return translate("qualityReduced");
  return translate("qualityNone");
}

/** Renders persisted forecast distributions; horizon changes are cache-only slices. */
export default function AnalysisPage() {
  const t = useTranslations("analysis");
  const query = useAnalysis();
  const refresh = useRefreshAnalysis();
  const [years, setYears] = useState(1);
  const notifiedFailure = useRef<string | null>(null);
  const data = query.data;
  const forecast = data?.forecast ?? null;
  const generationActive =
    data?.generation?.status === "PENDING" || data?.generation?.status === "RUNNING";
  const refreshPending = refresh.isPending || generationActive;
  const horizonItems = Object.fromEntries(
    HORIZON_OPTIONS.map((option) => [String(option.years), t("horizonYears", { years: option.years })]),
  );

  useEffect(() => {
    const failure = data?.generation?.failedAt ? String(data.generation.failedAt) : null;
    if (!failure || data?.generation?.status !== "FAILED" || notifiedFailure.current === failure) return;
    notifiedFailure.current = failure;
    toast.error(t("simulationFailed"));
  }, [data?.generation?.failedAt, data?.generation?.status, t]);

  const rows = useMemo(() => {
    if (!forecast) return null;
    const payload = forecast.payload;
    const end = (key: keyof typeof payload.series) => sliceForecastSeries(payload.series[key], years);
    const currentMonth = <T extends { value: number }>(values: T[]) => values.at(-1)?.value ?? 0;
    return {
      netWorth: buildForecastChartRows({
        history: payload.historical.netWorth,
        forecast: end("netWorth"),
        cutoff: String(forecast.dataCutoff).slice(0, 10),
        currentValue: payload.current.total,
      }),
      income: buildForecastChartRows({
        history: payload.historical.income,
        forecast: end("income"),
        cutoff: String(forecast.dataCutoff).slice(0, 10),
        currentValue: currentMonth(payload.historical.income),
      }),
      expenses: buildForecastChartRows({
        history: payload.historical.expenses,
        forecast: end("expenses"),
        cutoff: String(forecast.dataCutoff).slice(0, 10),
        currentValue: currentMonth(payload.historical.expenses),
      }),
      investments: buildForecastChartRows({
        history: payload.historical.investments,
        historicalOverlay: payload.historical.contributions,
        forecast: end("investments"),
        cutoff: String(forecast.dataCutoff).slice(0, 10),
        currentValue: payload.current.investments,
      }),
    };
  }, [forecast, years]);

  const runRefresh = () => {
    refresh.mutate(undefined, {
      onSuccess: (result) =>
        toast.success(
          result.status === "QUEUED" ? t("simulationQueued") : t("simulationAlreadyRunning"),
        ),
      onError: () => toast.error(t("simulationError")),
    });
  };

  if (query.isLoading) return <ForecastLoading />;

  if (query.isError && !data) {
    return (
      <Alert variant="destructive">
        <TriangleAlert />
        <AlertTitle>{t("loadErrorTitle")}</AlertTitle>
        <AlertDescription>{t("loadErrorDescription")}</AlertDescription>
      </Alert>
    );
  }

  const refreshButton = (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label={t("newSimulation")}
            disabled={refreshPending}
            onClick={runRefresh}
          />
        }
      >
        {refreshPending ? <Spinner /> : <RefreshCw />}
      </TooltipTrigger>
      <TooltipContent>{t("newSimulation")}</TooltipContent>
    </Tooltip>
  );

  if (!forecast) {
    return (
      <Card className="min-h-[360px]">
        <CardHeader>
          <CardTitle>{t("pendingTitle")}</CardTitle>
          <CardDescription>{t("description")}</CardDescription>
          <CardAction>{refreshButton}</CardAction>
        </CardHeader>
        <CardContent className="flex flex-1">
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon"><ChartNoAxesCombined /></EmptyMedia>
              <EmptyTitle>{t("pendingTitle")}</EmptyTitle>
              <EmptyDescription>{t("pendingDescription")}</EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button type="button" onClick={runRefresh} disabled={refreshPending}>
                {refreshPending ? <Spinner data-icon="inline-start" /> : <RefreshCw data-icon="inline-start" />}
                {t("newSimulation")}
              </Button>
            </EmptyContent>
          </Empty>
        </CardContent>
      </Card>
    );
  }

  if (!forecast.payload.hasData) {
    return (
      <Card className="min-h-[360px]">
        <CardHeader>
          <CardTitle>{t("noDataTitle")}</CardTitle>
          <CardAction>{refreshButton}</CardAction>
        </CardHeader>
        <CardContent className="flex flex-1">
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon"><ChartNoAxesCombined /></EmptyMedia>
              <EmptyTitle>{t("noDataTitle")}</EmptyTitle>
              <EmptyDescription>{t("noDataDescription")}</EmptyDescription>
            </EmptyHeader>
          </Empty>
        </CardContent>
      </Card>
    );
  }

  const payload = forecast.payload;
  const currency = payload.baseCurrency;
  const end = (key: keyof typeof payload.series) => sliceForecastSeries(payload.series[key], years).at(-1)!;
  const money = (value: number) => <PrivateNumber text={formatMoney(value, currency)} />;
  const commonLabels = (section: string) => ({
    today: t("today"),
    actual: t("actual"),
    median: t("median"),
    mean: t("mean"),
    range: t("range"),
    interpretation: t("interpretation"),
    aria: t("chartAria", { section }),
  });
  const netWorthEnd = end("netWorth");
  const incomeEnd = end("income");
  const expenseEnd = end("expenses");
  const investmentEnd = end("investments");
  const surplusMean =
    sliceForecastSeries(payload.series.surplus, years).reduce((sum, point) => sum + point.mean, 0) /
    (years * 12);
  const returnSummary = payload.summary.investmentReturn;

  return (
    <div className="flex flex-col gap-4 animate-fu md:gap-5">
      <section className="flex flex-col gap-3 rounded-xl border border-border/80 bg-card px-4 py-3 shadow-card sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="max-w-[72ch] text-sm text-muted-foreground">{t("description")}</p>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span>{t("lastUpdated", { date: formatDateTime(forecast.generatedAt) })}</span>
            <span>{t("dataThrough", { date: formatDate(forecast.dataCutoff) })}</span>
            <span>{t("lookback", { months: forecast.effectiveLookbackMonths })}</span>
            <span>{t("simulations", { count: formatNumber(forecast.simulationCount, 0) })}</span>
            <Badge variant="secondary">{qualityLabel(forecast, t)}</Badge>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Select
            value={String(years)}
            items={horizonItems}
            onValueChange={(value) => {
              const selected = Number(value);
              if (HORIZON_OPTIONS.some((option) => option.years === selected)) setYears(selected);
            }}
          >
            <SelectTrigger aria-label={t("horizon")} className="min-w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {HORIZON_OPTIONS.map((option) => (
                  <SelectItem key={option.years} value={String(option.years)}>
                    {t("horizonYears", { years: option.years })}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
          {refreshButton}
        </div>
      </section>

      {query.isError ? (
        <Alert variant="destructive">
          <TriangleAlert />
          <AlertTitle>{t("loadErrorTitle")}</AlertTitle>
          <AlertDescription>{t("loadErrorDescription")}</AlertDescription>
        </Alert>
      ) : null}

      {data?.generation?.status === "FAILED" ? (
        <Alert variant="destructive">
          <TriangleAlert />
          <AlertTitle>{t("simulationFailed")}</AlertTitle>
          <AlertDescription>{t("simulationFailedDescription")}</AlertDescription>
        </Alert>
      ) : null}

      {years >= 10 ? (
        <Alert>
          <TriangleAlert />
          <AlertTitle>{t("longHorizonWarning")}</AlertTitle>
          <AlertDescription>{t("estimateNotice")}</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid grid-cols-1 gap-4 md:gap-5 lg:grid-cols-2">
        <ForecastSection
          className="lg:col-span-2"
          title={t("netWorthTitle")}
          description={t("netWorthDescription")}
          rows={rows!.netWorth}
          currency={currency}
          labels={commonLabels(t("netWorthTitle"))}
          explanationRows={[
            { label: t("startingValue"), value: money(payload.current.total) },
            { label: t("medianAtHorizon", { years }), value: money(netWorthEnd.p50) },
            { label: t("likelyRange"), value: <>{money(netWorthEnd.p10)} – {money(netWorthEnd.p90)}</> },
            { label: t("projectedSurplus"), value: money(surplusMean) },
          ]}
          note={`${payload.assumptions.recurringMovementsIncluded ? t("recurringIncluded") : t("recurringNotIncluded")} ${t("flatAssumption")}`}
        />
        <ForecastSection
          title={t("incomeTitle")}
          description={t("incomeDescription")}
          rows={rows!.income}
          currency={currency}
          color="var(--positive)"
          labels={commonLabels(t("incomeTitle"))}
          explanationRows={[
            { label: t("averageMonthly"), value: money(payload.summary.averageMonthlyIncome) },
            { label: t("variability"), value: money(payload.summary.incomeVariability) },
            { label: t("medianAtHorizon", { years }), value: money(incomeEnd.p50) },
            { label: t("likelyRange"), value: <>{money(incomeEnd.p10)} – {money(incomeEnd.p90)}</> },
          ]}
        />
        <ForecastSection
          title={t("expensesTitle")}
          description={t("expensesDescription")}
          rows={rows!.expenses}
          currency={currency}
          color="var(--negative)"
          labels={commonLabels(t("expensesTitle"))}
          explanationRows={[
            { label: t("averageMonthly"), value: money(payload.summary.averageMonthlyExpenses) },
            { label: t("variability"), value: money(payload.summary.expenseVariability) },
            { label: t("medianAtHorizon", { years }), value: money(expenseEnd.p50) },
            { label: t("likelyRange"), value: <>{money(expenseEnd.p10)} – {money(expenseEnd.p90)}</> },
          ]}
        />
        <ForecastSection
          className="lg:col-span-2"
          title={t("investmentsTitle")}
          description={t("investmentsDescription")}
          rows={rows!.investments}
          currency={currency}
          color="var(--chart-4)"
          labels={{ ...commonLabels(t("investmentsTitle")), actual: t("portfolioValue") }}
          historicalOverlayLabel={t("contributions")}
          explanationRows={[
            { label: t("startingValue"), value: money(payload.current.investments) },
            { label: t("medianAtHorizon", { years }), value: money(investmentEnd.p50) },
            { label: t("likelyRange"), value: <>{money(investmentEnd.p10)} – {money(investmentEnd.p90)}</> },
            { label: t("averageContributions"), value: money(payload.summary.averageMonthlyContributions) },
            {
              label: t("portfolioReturn"),
              value: returnSummary.cagr == null
                ? "—"
                : <PrivateNumber text={formatPercent(returnSummary.cagr * 100)} />,
            },
          ]}
          note={
            returnSummary.cagr == null
              ? `${t("returnUnavailable")} ${t("contributionSeparation")}`
              : `${t("portfolioReturnPeriod", { months: returnSummary.observationMonths })} ${t("contributionSeparation")}`
          }
        />
      </div>

      <Alert>
        <TriangleAlert />
        <AlertTitle>{t("estimateNotice")}</AlertTitle>
        <AlertDescription>{years >= 10 ? t("longHorizonWarning") : t("flatAssumption")}</AlertDescription>
      </Alert>

      {data ? <AiInterpretation data={data} /> : null}
    </div>
  );
}
