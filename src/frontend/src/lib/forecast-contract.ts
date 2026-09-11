import type { InferResponseType } from "hono/client";
import { api } from "@/lib/api-client";

export type ForecastResponse = InferResponseType<typeof api.forecast.$get, 200>;
export type ForecastSnapshot = NonNullable<ForecastResponse["snapshot"]>;
export type ForecastPoint = ForecastSnapshot["series"]["netWorth"][number];
export type HistoricalPoint = ForecastSnapshot["history"]["netWorth"][number];
