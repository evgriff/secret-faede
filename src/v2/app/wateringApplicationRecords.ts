import type {
  WaterApplication,
  WateringArea,
  WateringRecommendation,
} from '../domain/watering';
import { gardenDateTimeToIso, getGardenDate } from '../domain/time';
import type { FeedCorrectWateringInput } from '../routes/feed';
import {
  type TodayWateringLogInput,
  wateringMethodEfficiency,
} from '../routes/today';

interface CreateWaterApplicationOptions {
  input: TodayWateringLogInput;
  nowIso: string;
  recommendation: WateringRecommendation | undefined;
  timezone: string;
  userId: string;
}

export function createWaterApplication({
  input,
  nowIso,
  recommendation,
  timezone,
  userId,
}: CreateWaterApplicationOptions): WaterApplication {
  const base = {
    appliedAtIso: applicationInstant(input.occurredOn, nowIso, timezone),
    cropGroupId: input.cropGroupId,
    id: `water-${input.cropGroupId}-${crypto.randomUUID()}`,
    method: input.method,
    recordedAtIso: nowIso,
    recordedByUserId: userId,
    revision: 1,
  } as const;

  if (input.outcome === 'skipped') {
    return { ...base, outcome: 'skipped', skipReason: input.skipReason };
  }
  return {
    ...base,
    amount: measuredAmount(input.amount, recommendation?.basis.area),
    efficiency: wateringMethodEfficiency(input.method),
    outcome: input.outcome,
  };
}

interface CorrectWaterApplicationOptions {
  area: WateringArea | undefined;
  input: FeedCorrectWateringInput;
  nowIso: string;
  original: WaterApplication;
  timezone: string;
}

export function correctWaterApplication({
  area,
  input,
  nowIso,
  original,
  timezone,
}: CorrectWaterApplicationOptions): WaterApplication {
  if (input.applicationId !== original.id) {
    throw new Error('The watering correction no longer matches its record.');
  }
  const originalDay = getGardenDate(original.appliedAtIso, timezone);
  const base = {
    appliedAtIso:
      originalDay === input.occurredOn
        ? original.appliedAtIso
        : gardenDateTimeToIso(input.occurredOn, '12:00', timezone, {
            ambiguous: 'later',
            missing: 'nextValid',
          }),
    cropGroupId: original.cropGroupId,
    id: original.id,
    method: input.method,
    recordedAtIso: nowIso,
    recordedByUserId: original.recordedByUserId,
    revision: original.revision + 1,
  } as const;

  if (input.outcome === 'skipped') {
    return { ...base, outcome: 'skipped', skipReason: input.skipReason };
  }
  const priorArea =
    original.outcome !== 'skipped' && original.amount.unit === 'gallons'
      ? original.amount.area
      : undefined;
  return {
    ...base,
    amount: measuredAmount(input.amount, priorArea ?? area),
    efficiency: wateringMethodEfficiency(input.method),
    outcome: input.outcome,
  };
}

function measuredAmount(
  amount: { unit: 'gallons' | 'inches'; value: number },
  area: WateringArea | undefined,
) {
  return amount.unit === 'inches'
    ? ({ depthInches: amount.value, unit: 'inches' } as const)
    : ({
        area: area ?? { reliability: 'unknown', squareFeet: null },
        gallons: amount.value,
        unit: 'gallons',
      } as const);
}

function applicationInstant(
  occurredOn: string,
  nowIso: string,
  timezone: string,
) {
  return getGardenDate(nowIso, timezone) === occurredOn
    ? nowIso
    : gardenDateTimeToIso(occurredOn, '12:00', timezone, {
        ambiguous: 'later',
        missing: 'nextValid',
      });
}
