"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { AlertTriangle, ChartSpline, Info, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import {
  FORECAST_HORIZONS,
  buildForecastChartModel,
  forecastExplanationFacts,
  forecastViewState,
  type AnalysisMetric,
  type ForecastHorizon,
  type ForecastSnapshot,
  type HistoricalPoint,
} from "@/components/analysis/analysis-model";
import { ForecastChart } from "@/components/analysis/forecast-chart";
import { PageHeader } from "@/components/page-header";
import { usePrivateNumberFormatter } from "@/components/private-number";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
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
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useForecast, useRefreshForecast } from "@/hooks/use-forecast";
import { formatDateTime, formatMoney, formatNumber, formatPercent } from "@/lib/format";

type ChartLabels = Parameters<typeof ForecastChart>[0]["labels"];
const QUALITY_KEYS = {
  HIGH: "qualityHigh",
  MEDIUM: "qualityMedium",
  LOW: "qualityLow",
} as const;

function AnalysisLoading() {
  return (
    <div className="flex flex-col gap-5" aria-busy="true">
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-4 w-[min(28rem,75vw)]" />
        </div>
        <Skeleton className="size-10" />
      </div>
      <Skeleton className="h-[430px] w-full rounded-[var(--card-radius)]" />
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Skeleton className="h-[390px] rounded-[var(--card-radius)]" />
        <Skeleton className="h-[390px] rounded-[var(--card-radius)]" />
      </div>
    </div>
  );
}

function MetricEmpty({ title, description }: { title: string; description: string }) {
  return (
    <Empty className="min-h-[260px] border">
      <EmptyHeader>
        <EmptyMedia variant="icon"><ChartSpline /></EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}

function Explanation({ text, assumptionsTitle, assumptions }: {
  text: string;
  assumptionsTitle: string;
  assumptions: string[];
}) {
  return (
    <CardFooter className="items-start">
      <div className="flex max-w-[75ch] flex-col gap-2 text-xs leading-relaxed">
        <p className="text-foreground">{text}</p>
        <div>
          <span className="font-semibold">{assumptionsTitle}: </span>
          <span className="text-muted-foreground">{assumptions.join(" ")}</span>
        </div>
      </div>
    </CardFooter>
  );
}

function ForecastSection({
  title,
  description,
  metric,
  snapshot,
  horizon,
  labels,
  ariaLabel,
  explanation,
  assumptions,
  assumptionsTitle,
  emptyTitle,
  emptyDescription,
  className,
}: {
  title: string;
  description: string;
  metric: AnalysisMetric;
  snapshot: ForecastSnapshot;
  horizon: ForecastHorizon;
  labels: ChartLabels;
  ariaLabel: string;
  explanation: string;
  assumptions: string[];
  assumptionsTitle: string;
  emptyTitle: string;
  emptyDescription: string;
  className?: string;
}) {
  const model = buildForecastChartModel(snapshot, metric, horizon);
  const hasUsableSeries = model.history.length > 0 && model.forecast.length > 0;
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {hasUsableSeries ? (
          <ForecastChart
            history={model.history}
            forecast={model.forecast}
            labels={labels}
            currency={snapshot.currency}
            ariaLabel={ariaLabel}
          />
        ) : (
          <MetricEmpty title={emptyTitle} description={emptyDescription} />
        )}
      </CardContent>
      <Explanation text={explanation} assumptionsTitle={assumptionsTitle} assumptions={assumptions} />
    </Card>
  );
}

/** Renders the authenticated persisted-forecast workspace. */
export default function AnalysisPage() {
  const t = useTranslations("analysis");
  const [horizon, setHorizon] = useState<ForecastHorizon>(1);
  const forecast = useForecast();
  const refresh = useRefreshForecast();
  const { privateText } = usePrivateNumberFormatter();
  const response = forecast.data;
  const state = forecast.isLoading ? "loading" : forecastViewState(response);
  const snapshot = response?.snapshot ?? null;
  const isRefreshing = refresh.isPending || response?.status === "GENERATING";

  const horizonItems = useMemo(
    () => FORECAST_HORIZONS.map((years) => ({ value: String(years), label: t("years", { years }) })),
    [t],
  );
  const chartLabels = useMemo<ChartLabels>(() => ({
    observed: t("observed"),
    median: t("median"),
    mean: t("mean"),
    outerBand: t("outerBand"),
    innerBand: t("innerBand"),
    today: t("today"),
  }), [t]);

  const startRefresh = () => {
    if (isRefreshing) {
      toast.info(t("refreshDuplicate"));
      return;
    }
    refresh.mutate(undefined, {
      onSuccess: () => {
        toast.success(t("refreshStarted"));
      },
      onError: (error) => {
        const duplicate = error instanceof Error && /already|running|progress/i.test(error.message);
        toast.error(duplicate ? t("refreshDuplicate") : t("refreshFailed"));
      },
    });
  };

  if (state === "loading") return <AnalysisLoading />;

  const refreshButton = (
    <Tooltip>
      <TooltipTrigger
        render={
          <span>
            <Button
              type="button"
              size="icon"
              variant="outline"
              aria-label={t("newSimulation")}
              disabled={isRefreshing}
              onClick={startRefresh}
            >
              {isRefreshing ? <Spinner /> : <RefreshCw />}
            </Button>
          </span>
        }
      />
      <TooltipContent>{t("newSimulation")}</TooltipContent>
    </Tooltip>
  );

  if (!snapshot) {
    const failed = state === "error" || forecast.isError;
    return (
      <div className="flex flex-col gap-5 animate-fu">
        <PageHeader title={t("title")} description={t("description")} action={refreshButton} />
        <Card>
          <CardContent>
            <Empty className="min-h-[360px]">
              <EmptyHeader>
                <EmptyMedia variant="icon">{failed ? <AlertTriangle /> : <ChartSpline />}</EmptyMedia>
                <EmptyTitle>{failed ? t("loadFailedTitle") : t("emptyTitle")}</EmptyTitle>
                <EmptyDescription>
                  {failed ? t("loadFailedDescription") : t("emptyDescription")}
                </EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <Button onClick={startRefresh} disabled={isRefreshing}>
                  {isRefreshing ? <Spinner data-icon="inline-start" /> : <RefreshCw data-icon="inline-start" />}
                  {t("newSimulation")}
                </Button>
              </EmptyContent>
            </Empty>
          </CardContent>
        </Card>
      </div>
    );
  }

  const slicedMonths = horizon * 12;
  const facts = forecastExplanationFacts(snapshot, horizon);
  const money = (value: number) => privateText(formatMoney(value, snapshot.currency));
  const assumptions = [...new Set(snapshot.assumptions.map((assumption) => {
    if (assumption.includes("recurring")) return t("assumptionRecurring");
    if (assumption.includes("flat")) return t("assumptionFlat");
    if (assumption.includes("no-invest")) return t("assumptionNoInvestments");
    if (assumption.includes("fallback") || assumption.includes("missing-market")) return t("assumptionFallback");
    if (assumption.includes("bootstrap") || assumption.includes("resampl")) return t("assumptionBootstrap");
    return t("assumptionModel");
  }))];
  if (assumptions.length === 0) assumptions.push(t("assumptionModel"));

  const noInvestments =
    snapshot.history.investments.length === 0 || snapshot.summary.startingPortfolioValue === 0;
  const contributionHistory: HistoricalPoint[] = snapshot.history.investments.map((point) => ({
    date: point.date,
    value: point.contribution ?? 0,
  }));
  const contributionForecast = snapshot.series.contributions.slice(0, slicedMonths);

  return (
    <div className="flex flex-col gap-5 animate-fu">
      <PageHeader title={t("title")} description={t("description")} action={refreshButton} />

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card px-3 py-2.5 shadow-card">
        <div className="flex min-w-0 flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span>{t("generatedAt", { date: formatDateTime(snapshot.generatedAt) })}</span>
          <span>{t("sourceAt", { date: formatDateTime(snapshot.sourceDataCutoff) })}</span>
          <span>{t("lookback", { months: snapshot.effectiveLookbackMonths })}</span>
          <span>{t("observations", { count: snapshot.observationCount })}</span>
          <span>{t("simulations", { count: formatNumber(snapshot.simulationCount, 0) })}</span>
          <span>{t("confidence", { quality: t(QUALITY_KEYS[snapshot.dataQuality]) })}</span>
        </div>
        <label className="flex shrink-0 items-center gap-2 text-xs font-semibold">
          {t("horizon")}
          <Select
            value={String(horizon)}
            items={horizonItems}
            onValueChange={(value) => {
              const next = Number(value);
              if (FORECAST_HORIZONS.includes(next as ForecastHorizon)) setHorizon(next as ForecastHorizon);
            }}
          >
            <SelectTrigger size="sm" aria-label={t("horizon")}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {horizonItems.map((item) => (
                  <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </label>
      </div>

      {isRefreshing ? (
        <Alert><Spinner /><AlertTitle>{t("refreshing")}</AlertTitle></Alert>
      ) : null}
      {state === "stale-error" ? (
        <Alert variant="destructive"><AlertTriangle /><AlertTitle>{t("refreshFailed")}</AlertTitle></Alert>
      ) : null}
      {snapshot.dataQuality === "LOW" ? (
        <Alert><Info /><AlertTitle>{t("sparseTitle")}</AlertTitle><AlertDescription>{t("sparseDescription", { months: snapshot.effectiveLookbackMonths })}</AlertDescription></Alert>
      ) : null}
      {horizon >= 10 ? (
        <Alert><Info /><AlertTitle>{t("longHorizonTitle")}</AlertTitle><AlertDescription>{t("longHorizonDescription", { years: horizon })}</AlertDescription></Alert>
      ) : null}

      <ForecastSection
        className="w-full"
        title={t("netWorthTitle")}
        description={t("netWorthDescription")}
        metric="netWorth"
        snapshot={snapshot}
        horizon={horizon}
        labels={chartLabels}
        ariaLabel={t("netWorthChartLabel", { years: horizon })}
        emptyTitle={t("emptyMetricTitle")}
        emptyDescription={t("emptyMetricDescription", { metric: t("netWorthTitle") })}
        assumptions={assumptions}
        assumptionsTitle={t("assumptionsTitle")}
        explanation={facts.netWorth
          ? t("netWorthExplanation", {
              start: money(facts.netWorth.start),
              years: horizon,
              median: money(facts.netWorth.p50),
              low: money(facts.netWorth.p10),
              high: money(facts.netWorth.p90),
              savings: money(facts.netWorth.savingsContribution),
              returns: money(facts.netWorth.investmentReturnContribution),
            })
          : t("emptyMetricDescription", { metric: t("netWorthTitle") })}
      />

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        {(["income", "expenses"] as const).map((metric) => (
          <ForecastSection
            key={metric}
            title={t(`${metric}Title`)}
            description={t(`${metric}Description`)}
            metric={metric}
            snapshot={snapshot}
            horizon={horizon}
            labels={chartLabels}
            ariaLabel={t(`${metric}ChartLabel`, { years: horizon })}
            emptyTitle={t("emptyMetricTitle")}
            emptyDescription={t("emptyMetricDescription", { metric: t(`${metric}Title`) })}
            assumptions={assumptions}
            assumptionsTitle={t("assumptionsTitle")}
            explanation={facts[metric]
              ? t("flowExplanation", {
                  months: snapshot.effectiveLookbackMonths,
                  years: horizon,
                  median: money(facts[metric].p50),
                  low: money(facts[metric].p10),
                  high: money(facts[metric].p90),
                })
              : t("emptyMetricDescription", { metric: t(`${metric}Title`) })}
          />
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("investmentsTitle")}</CardTitle>
          <CardDescription>{t("investmentsDescription")}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          {noInvestments ? (
            <MetricEmpty title={t("noInvestmentsTitle")} description={t("noInvestmentsDescription")} />
          ) : (
            <>
              <ForecastChart
                history={snapshot.history.investments.slice(-24)}
                forecast={snapshot.series.investments.slice(0, slicedMonths)}
                labels={chartLabels}
                currency={snapshot.currency}
                ariaLabel={t("investmentsChartLabel", { years: horizon })}
              />
              <div className="border-t pt-5">
                <h3 className="text-sm font-semibold">{t("contributionsTitle")}</h3>
                <p className="mb-2 text-xs text-muted-foreground">{t("contributionsDescription")}</p>
                <ForecastChart
                  history={contributionHistory.slice(-24)}
                  forecast={contributionForecast}
                  labels={chartLabels}
                  currency={snapshot.currency}
                  ariaLabel={t("contributionsChartLabel", { years: horizon })}
                  className="h-[220px] sm:h-[260px]"
                />
              </div>
            </>
          )}
        </CardContent>
        <Explanation
          assumptionsTitle={t("assumptionsTitle")}
          assumptions={assumptions}
          text={t("investmentExplanation", {
            start: money(facts.investments.start),
            rate: facts.investments.flowAdjustedReturnRate == null
              ? t("notAvailable")
              : privateText(formatPercent(facts.investments.flowAdjustedReturnRate * 100)),
            months: facts.investments.observationMonths,
          })}
        />
      </Card>

      <Alert><Info /><AlertDescription>{t("estimateNotice")}</AlertDescription></Alert>
    </div>
  );
}
