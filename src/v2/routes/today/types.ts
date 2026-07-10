import type { ComponentType, ReactNode } from 'react';

import type { GardenTask } from '../../domain';
import type {
  WaterApplication,
  WaterDataQuality,
  WateringArea,
  WateringRecommendation,
} from '../../domain/watering';

export interface TodayLinkProps {
  children: ReactNode;
  className?: string;
  to: string;
}

export type TodayLinkComponent = ComponentType<TodayLinkProps>;
export type TodayLoadState = 'error' | 'loading' | 'ready';
export type TodayDateRange = 'all' | 'next3Days' | 'next7Days' | 'today';
export type TodayActionResult = 'queued' | 'saved' | void;

export interface TodayWeatherAlert {
  deepLink: string;
  detail: string;
  effectiveAtIso: string;
  expiresAtIso: string | null;
  id: string;
  severity: 'advisory' | 'warning' | 'watch';
  title: string;
}

export interface TodayWeatherSummary {
  alerts: readonly TodayWeatherAlert[];
  currentTemperatureF: number | null;
  expectedRainInches: number | null;
  highTemperatureF: number | null;
  lowTemperatureF: number | null;
  observedAtIso: string | null;
  precipitationProbabilityPercent: number | null;
  quality: WaterDataQuality;
  summary: string;
}

export type WateringLogOutcome = 'applied' | 'partial' | 'skipped';
export type WateringMethod = WaterApplication['method'];
export type TodayWateringAmount =
  | { unit: 'gallons'; value: number }
  | { unit: 'inches'; value: number };

interface TodayWateringLogBase {
  cropGroupId: string;
  method: WateringMethod;
  occurredOn: string;
  recommendationId: string;
}

export type TodayWateringLogInput =
  | (TodayWateringLogBase & {
      amount: TodayWateringAmount;
      outcome: 'applied' | 'partial';
      skipReason: null;
    })
  | (TodayWateringLogBase & {
      amount: null;
      creditedDepthInches: 0;
      outcome: 'skipped';
      skipReason: string;
    });

export interface WateringLogDraft {
  amount: string;
  amountUnit: TodayWateringAmount['unit'];
  method: WateringMethod;
  occurredOn: string;
  outcome: WateringLogOutcome;
  skipReason: string;
}

export interface TodayTaskActionInput {
  action: 'complete' | 'defer' | 'reopen' | 'snooze';
  nextDueOn: string | null;
  taskId: string;
}

export interface TodayPageProps {
  errorMessage?: string | null;
  focus?: 'task' | 'watering' | 'weather' | null;
  focusId?: string | null;
  isOnline: boolean;
  LinkComponent: TodayLinkComponent;
  loadState?: TodayLoadState;
  nowIso: string;
  onLogWatering(input: TodayWateringLogInput): Promise<TodayActionResult>;
  onRefreshWeather?(): Promise<void> | void;
  onRetry?(): Promise<void> | void;
  onTaskAction(input: TodayTaskActionInput): Promise<TodayActionResult>;
  recommendations: readonly WateringRecommendation[];
  tasks: readonly GardenTask[];
  timezone: string;
  weather: TodayWeatherSummary | null;
}

export interface RecommendationDisplay {
  amount: string | null;
  instruction: string;
  statusLabel: string;
  statusTone: 'info' | 'success' | 'warning';
}

export interface WateringLogErrors {
  amount?: string;
  occurredOn?: string;
  skipReason?: string;
}

export interface RecommendationBasisRow {
  label: string;
  value: string;
}

export interface TodayTaskGroup {
  label: string;
  tasks: GardenTask[];
}

export interface WateringAreaContext {
  area: WateringArea;
  recommendation: WateringRecommendation;
}
