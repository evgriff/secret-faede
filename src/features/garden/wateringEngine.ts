import {
  detroitLocation,
  type DrainageProfile,
  type Garden,
  type GardenLocation,
  type Planting,
  type SoilType,
  type Structure,
  type WateringScheduleEntry,
  type WeatherSnapshot,
} from '../../domain/gardens/GardenRepository';
import type {
  OptionalAgricultureMetrics,
  RecentPrecipitation,
  WeatherAlert,
  WeatherCurrentConditions,
  WeatherForecast,
  WeatherLocation,
  WeatherProvider,
  WeatherRequestOptions,
} from '../../domain/weather/WeatherProvider';
import { getStructureFootprint } from './gardenPlanning';
import {
  ACTIVE_WATERING_STATUSES,
  DIRECT_SOW_WATER_CREDIT_INCHES,
  PLANTED_OUT_WATER_CREDIT_INCHES,
  WATER_BALANCE_MODEL_VERSION,
  fallbackCropWaterNeed,
  getLifecycleAllowedDepletionInches,
  getLifecycleDailyNeedInches,
  getLifecycleEffectiveRainCreditInches,
  getLifecycleRootZoneCapacityInches,
  getPlantingWaterProfile,
  getTargetLifecycleStage,
  type PlantingWaterProfile,
} from './wateringLifecycle';

export interface WeatherWateringContext {
  agricultureMetrics: OptionalAgricultureMetrics;
  alerts: WeatherAlert[];
  currentConditions: WeatherCurrentConditions;
  forecast: WeatherForecast;
  recentPrecipitation: RecentPrecipitation;
}

export interface WateringScheduleDefaults {
  defaultWateringCheckTime?: string | null;
  timezone?: string | null;
}

interface WaterTarget {
  drainageProfile: DrainageProfile;
  id: string;
  irrigationZone: string | null;
  isContainer: boolean;
  label: string;
  lifecycleStage: 'establishing' | 'mixed' | 'steady';
  memberCount: number;
  plantings: Planting[];
  mulched: boolean;
  soilType: SoilType;
  targetKind: 'bed' | 'planting';
  waterNeedSource: 'cropProfile' | 'fallback' | 'manual';
  weeklyWaterNeedInches: number;
}

interface ManualWateringHistory {
  appliedAmountInches: number;
  lastWateredAtIso: string | null;
}

interface PlantingWaterBaseline {
  baselineDate: string | null;
  baselineSource: NonNullable<
    WateringScheduleEntry['waterBalance']
  >['baselineSource'];
  plantingWaterCreditInches: number;
}

interface WaterBalanceCalculation {
  actionableDeficitInches: number;
  allowedDepletionInches: number;
  baselineDate: string;
  baselineSource: NonNullable<
    WateringScheduleEntry['waterBalance']
  >['baselineSource'];
  currentDepletionInches: number;
  dailyNeedInches: number;
  deficitBeforeForecastInches: number;
  elapsedDays: number;
  forecastCreditInches: number;
  manualWaterCreditInches: number;
  nextCheckReason: string;
  plantingWaterCreditInches: number;
  rawNeedInches: number;
  recentRainCreditInches: number;
  rootZoneCapacityInches: number;
  targetAmountInches: number;
  thresholdInches: number;
  waterBalance: NonNullable<WateringScheduleEntry['waterBalance']>;
}

export async function loadWeatherWateringContext(
  provider: WeatherProvider,
  gardenLocation: GardenLocation,
  options: WeatherRequestOptions = {},
): Promise<WeatherWateringContext> {
  const location = toWeatherLocation(gardenLocation);
  const [
    currentConditions,
    forecast,
    alerts,
    recentPrecipitation,
    agricultureMetrics,
  ] = await Promise.all([
    provider.getCurrentConditions(location, options),
    provider.getForecast(location, options),
    provider.getWeatherAlerts(location, options),
    provider.getRecentPrecipitation(location, 72, options),
    provider.getOptionalAgricultureMetrics(location, options),
  ]);

  return {
    agricultureMetrics,
    alerts,
    currentConditions,
    forecast,
    recentPrecipitation,
  };
}

export function createWeatherSnapshot(
  garden: Garden,
  context: WeatherWateringContext,
  now = new Date(),
): WeatherSnapshot {
  const observedForDate = formatLocalDate(now, garden.plot.location.timezone);

  return {
    alertSummaries: context.alerts
      .slice(0, 4)
      .map((alert) => alert.headline || alert.event),
    capturedAtIso: now.toISOString(),
    conditionSummary: context.currentConditions.conditionSummary,
    dataQuality: getWeatherDataQuality(context),
    evapotranspirationIn:
      context.agricultureMetrics.evapotranspirationNext24hIn,
    forecastDays: buildForecastDays(
      context.forecast,
      garden.plot.location.timezone,
      observedForDate,
    ),
    forecastRainNext24In: context.forecast.next24hPrecipIn,
    forecastRainNext48In: context.forecast.next48hPrecipIn,
    frostRisk: getFrostRisk(context.forecast.overnightLowF),
    gardenId: garden.id,
    heatRisk: getHeatRisk(context.forecast.dailyHighF),
    humidityPercent: context.currentConditions.humidityPercent,
    id: `weather-${now.toISOString()}`,
    nextRainIso: context.forecast.nextRainIso,
    observedForDate,
    overnightLowF: context.forecast.overnightLowF,
    precipitationIn: context.recentPrecipitation.totalIn,
    providerDecision:
      context.currentConditions.providerId === 'tomorrowIo'
        ? 'Tomorrow.io enhanced weather was used with NWS alerts and precipitation fallback.'
        : 'National Weather Service was used as the default weather provider.',
    providerLabel: context.currentConditions.sourceLabel,
    recentPrecipitation72hIn: context.recentPrecipitation.last72hIn,
    source: context.currentConditions.providerId,
    temperatureF: context.currentConditions.temperatureF,
    windMph: context.currentConditions.windMph,
  };
}

export function buildWateringSchedule(
  garden: Garden,
  context: WeatherWateringContext,
  snapshot: WeatherSnapshot,
  now = new Date(),
  defaults: WateringScheduleDefaults = {},
): WateringScheduleEntry[] {
  const scheduleTimezone = defaults.timezone || garden.plot.location.timezone;
  const wateringCheckTime = defaults.defaultWateringCheckTime ?? '07:00';
  const dueDate = formatLocalDate(now, scheduleTimezone);

  return getWaterTargets(garden, now).flatMap(
    (target): WateringScheduleEntry[] => {
      const createdAtIso = now.toISOString();
      const dueWindowStartIso = resolveWateringCheckWindowStartIso(
        dueDate,
        scheduleTimezone,
        wateringCheckTime,
      );
      const nextRecalculationAtIso = getNextRecalculationAtIso(
        context.forecast,
        now,
      );
      const manualWateringHistory = estimateManualWatering(garden, target, now);
      const balance = calculateWaterBalance({
        context,
        garden,
        manualWateringHistory,
        now,
        scheduleTimezone,
        target,
      });

      if (balance.deficitBeforeForecastInches < balance.thresholdInches) {
        return [];
      }

      const suppressUntilIso = getSuppressUntilIso(
        context.forecast,
        balance.deficitBeforeForecastInches,
        balance.forecastCreditInches,
        balance.thresholdInches,
        now,
      );
      let status: WateringScheduleEntry['status'];
      let targetAmountInches = balance.targetAmountInches;
      let deficitInches = balance.targetAmountInches;

      if (suppressUntilIso) {
        status = 'suppressed';
        targetAmountInches = 0;
        deficitInches = roundTo(balance.deficitBeforeForecastInches, 2);
      } else {
        status = isBeforeWateringCheck(now, scheduleTimezone, wateringCheckTime)
          ? 'scheduled'
          : balance.manualWaterCreditInches > 0
            ? 'partial'
            : 'due';
      }

      const urgency = getUrgency(
        status === 'suppressed' ? deficitInches : targetAmountInches,
        context.forecast.dailyHighF,
        target,
      );
      const rationale = buildRationale({
        balance,
        deficitInches,
        status,
        target,
        targetAmountInches,
        wateringCheckTime,
      });

      return [
        {
          appliedAmountInches:
            balance.manualWaterCreditInches > 0
              ? balance.manualWaterCreditInches
              : null,
          createdAtIso,
          deficitInches,
          dueDate,
          dueWindowEndIso: nextRecalculationAtIso,
          dueWindowStartIso,
          gardenId: garden.id,
          id: `water-${target.targetKind}-${target.id}-${dueDate}`,
          lastWateredAtIso: manualWateringHistory.lastWateredAtIso,
          nextRecalculationAtIso,
          reasonDetails: rationale,
          reasonSummary: rationale[0] ?? 'Watering check scheduled.',
          source: 'client',
          status,
          targetId: target.id,
          targetAmountInches,
          targetKind: target.targetKind,
          targetLabel: target.label,
          updatedAtIso: createdAtIso,
          urgency,
          dataQuality: getRecommendationDataQuality(context, target),
          waterBalance: balance.waterBalance,
          wateringZoneId: target.irrigationZone,
          weatherSnapshotId: snapshot.id,
        },
      ];
    },
  );
}

export function mergeWateringSchedule(
  existing: WateringScheduleEntry[],
  generated: WateringScheduleEntry[],
  options: { preserveDueWindowStart?: boolean } = {},
) {
  const preserveDueWindowStart = options.preserveDueWindowStart ?? true;
  const existingById = new Map(existing.map((entry) => [entry.id, entry]));
  const generatedIds = new Set(generated.map((entry) => entry.id));
  const preserved = existing.filter(
    (entry) =>
      !generatedIds.has(entry.id) &&
      entry.status !== 'due' &&
      entry.status !== 'partial' &&
      entry.status !== 'scheduled' &&
      entry.status !== 'suppressed',
  );
  const mergedGenerated = generated.map((entry) => {
    const existingEntry = existingById.get(entry.id);

    if (!existingEntry) {
      return entry;
    }

    const mergedEntry = {
      ...entry,
      createdAtIso: existingEntry.createdAtIso ?? entry.createdAtIso,
      dueWindowStartIso: preserveDueWindowStart
        ? (existingEntry.dueWindowStartIso ?? entry.dueWindowStartIso)
        : entry.dueWindowStartIso,
    };

    if (
      existingEntry.status !== 'completed' &&
      existingEntry.status !== 'partial' &&
      existingEntry.status !== 'skipped' &&
      existingEntry.status !== 'snoozed'
    ) {
      return mergedEntry;
    }

    return {
      ...mergedEntry,
      appliedAmountInches:
        existingEntry.appliedAmountInches ?? entry.appliedAmountInches,
      lastWateredAtIso:
        existingEntry.lastWateredAtIso ?? entry.lastWateredAtIso,
      nextRecalculationAtIso:
        existingEntry.nextRecalculationAtIso ?? entry.nextRecalculationAtIso,
      status: existingEntry.status,
      updatedAtIso: existingEntry.updatedAtIso ?? entry.updatedAtIso,
    };
  });

  return [...preserved.slice(-20), ...mergedGenerated];
}

export const buildWaterRecommendations = buildWateringSchedule;

function getWaterTargets(garden: Garden, now: Date): WaterTarget[] {
  const groupedPlantings = new Map<string, Planting[]>();
  const standalonePlantings: Array<{
    planting: Planting;
    structure: Structure | undefined;
  }> = [];

  garden.plantings
    .filter((planting) => ACTIVE_WATERING_STATUSES.has(planting.status))
    .forEach((planting) => {
      const structure = getPlantingStructure(garden, planting);

      if (structure && isWaterableBed(structure)) {
        const plantings = groupedPlantings.get(structure.id) ?? [];
        plantings.push(planting);
        groupedPlantings.set(structure.id, plantings);
        return;
      }

      standalonePlantings.push({ planting, structure });
    });

  return [
    ...garden.structures.flatMap((structure): WaterTarget[] => {
      if (!isWaterableBed(structure)) {
        return [];
      }

      const structurePlantings = groupedPlantings.get(structure.id) ?? [];

      return structurePlantings.length > 0
        ? [createBedTarget(structure, structurePlantings, now)]
        : [];
    }),
    ...standalonePlantings.map(({ planting, structure }) =>
      createPlantingTarget(planting, structure, now),
    ),
  ];
}

function createPlantingTarget(
  planting: Planting,
  structure: Structure | undefined,
  now: Date,
): WaterTarget {
  const containerMultiplier = getStructureWaterMultiplier(structure);
  const waterProfile = getPlantingWaterProfile(
    planting,
    now,
    fallbackCropWaterNeed,
  );

  return {
    drainageProfile: structure?.drainageProfile ?? 'unknown',
    id: planting.id,
    irrigationZone:
      planting.irrigationZone ?? structure?.irrigationZone ?? null,
    isContainer: structure?.type === 'container',
    label: planting.label,
    lifecycleStage: waterProfile.lifecycleStage,
    memberCount: 1,
    mulched: planting.mulched,
    plantings: [planting],
    soilType: structure?.soilType ?? 'unknown',
    targetKind: 'planting',
    waterNeedSource: waterProfile.waterNeedSource,
    weeklyWaterNeedInches:
      waterProfile.weeklyWaterNeedInches * containerMultiplier,
  };
}

function createBedTarget(
  structure: Structure,
  bedPlantings: Planting[],
  now: Date,
): WaterTarget {
  const plantWaterProfiles = bedPlantings.map((planting) =>
    getPlantingWaterProfile(planting, now, fallbackCropWaterNeed),
  );
  const highestCropNeed = Math.max(
    ...plantWaterProfiles.map((profile) => profile.weeklyWaterNeedInches),
  );
  const bedMultiplier =
    structure.type === 'container'
      ? 1.25
      : structure.type === 'raisedBed' || structure.type === 'bed'
        ? 1.1
        : 1;

  return {
    drainageProfile: structure.drainageProfile ?? 'unknown',
    id: structure.id,
    irrigationZone: structure.irrigationZone ?? null,
    isContainer: structure.type === 'container',
    label: structure.label,
    lifecycleStage: getTargetLifecycleStage(bedPlantings, now),
    memberCount: bedPlantings.length,
    mulched: structure.mulched,
    plantings: bedPlantings,
    soilType: structure.soilType ?? 'unknown',
    targetKind: 'bed',
    waterNeedSource: combineWaterNeedSources(plantWaterProfiles),
    weeklyWaterNeedInches: highestCropNeed * bedMultiplier,
  };
}

function getPlantingStructure(garden: Garden, planting: Planting) {
  return garden.structures.find(
    (candidate) =>
      isWaterableBed(candidate) &&
      isPointInsideStructure(planting.xFt, planting.yFt, candidate),
  );
}

function getStructureWaterMultiplier(structure: Structure | undefined) {
  if (!structure) {
    return 1;
  }

  if (structure.type === 'container') {
    return 1.25;
  }

  if (structure.type === 'raisedBed' || structure.type === 'bed') {
    return 1.05;
  }

  return 1;
}

function isWaterableBed(structure: Structure) {
  return (
    structure.type === 'bed' ||
    structure.type === 'container' ||
    structure.type === 'inGroundBed' ||
    structure.type === 'raisedBed'
  );
}

function isPointInsideStructure(
  xFt: number,
  yFt: number,
  structure: Structure,
) {
  const footprint = getStructureFootprint(structure);

  return (
    xFt >= footprint.xFt &&
    xFt <= footprint.xFt + footprint.widthFt &&
    yFt >= footprint.yFt &&
    yFt <= footprint.yFt + footprint.depthFt
  );
}

function estimateManualWatering(
  garden: Garden,
  target: WaterTarget,
  now: Date,
) {
  const targetText = target.label.toLowerCase();
  const start = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000);

  return garden.journalEntries.reduce<ManualWateringHistory>(
    (history, entry) => {
      const entryIso = getJournalEntryIso(entry.createdAtIso, entry.occurredOn);
      const entryDate = new Date(entryIso);
      const text = `${entry.title} ${entry.body}`.toLowerCase();
      const directMatch =
        target.targetKind === 'planting'
          ? entry.plantingId === target.id
          : entry.structureId === target.id ||
            target.plantings.some(
              (planting) => entry.plantingId === planting.id,
            );
      const labelMatch =
        entry.targetLabel.toLowerCase() === targetText ||
        target.plantings.some(
          (planting) =>
            entry.targetLabel.toLowerCase() === planting.label.toLowerCase(),
        ) ||
        text.includes(targetText);

      if (
        Number.isNaN(entryDate.getTime()) ||
        entryDate < start ||
        !text.includes('water') ||
        (!directMatch && !labelMatch)
      ) {
        return history;
      }

      return {
        appliedAmountInches:
          history.appliedAmountInches + readWaterAmountInches(text),
        lastWateredAtIso:
          !history.lastWateredAtIso ||
          entryDate.getTime() > Date.parse(history.lastWateredAtIso)
            ? entryIso
            : history.lastWateredAtIso,
      };
    },
    {
      appliedAmountInches: 0,
      lastWateredAtIso: null,
    },
  );
}

function calculateWaterBalance({
  context,
  manualWateringHistory,
  now,
  scheduleTimezone,
  target,
}: {
  context: WeatherWateringContext;
  garden: Garden;
  manualWateringHistory: ManualWateringHistory;
  now: Date;
  scheduleTimezone: string;
  target: WaterTarget;
}): WaterBalanceCalculation {
  const today = formatLocalDate(now, scheduleTimezone);
  const plantingBaseline = getPlantingWaterBaseline(
    target.plantings,
    now,
    scheduleTimezone,
  );
  const fallbackBaselineDate = addLocalDays(today, -3);
  const baselineDate = plantingBaseline.baselineDate ?? fallbackBaselineDate;
  const baselineSource = plantingBaseline.baselineDate
    ? plantingBaseline.baselineSource
    : 'fallbackWeatherWindow';
  const elapsedDays = Math.max(daysBetweenLocalDates(baselineDate, today), 0);
  const dailyNeedInches = getLifecycleDailyNeedInches(target, {
    dailyHighF: context.forecast.dailyHighF,
    evapotranspirationIn:
      context.agricultureMetrics.evapotranspirationNext24hIn,
  });
  const rawNeedInches = dailyNeedInches * elapsedDays;
  const rootZoneCapacityInches = getLifecycleRootZoneCapacityInches(target);
  const recentRainCreditInches = getRecentRainCredit(
    context,
    target,
    baselineDate,
  );
  const manualWaterCreditInches = roundTo(
    Math.min(manualWateringHistory.appliedAmountInches, rawNeedInches),
    2,
  );
  const plantingWaterCreditInches =
    elapsedDays === 0 ? plantingBaseline.plantingWaterCreditInches : 0;
  const currentDepletionInches = roundTo(
    Math.min(
      Math.max(
        rawNeedInches - recentRainCreditInches - manualWaterCreditInches,
        0,
      ),
      rootZoneCapacityInches,
    ),
    2,
  );
  const deficitBeforeForecastInches = currentDepletionInches;
  const forecastCreditInches = getForecastRainCredit(context, target);
  const allowedDepletionInches = getDueThresholdInches(
    target,
    context.forecast.dailyHighF,
  );
  const thresholdInches = allowedDepletionInches;
  const actionableDeficitInches = roundTo(
    Math.max(deficitBeforeForecastInches - forecastCreditInches, 0),
    2,
  );
  const targetAmountInches = actionableDeficitInches;
  const nextCheckReason = getNextCheckReason({
    deficitBeforeForecastInches,
    forecastCreditInches,
    hasQualitativeRainSignal: hasQualitativeRainSignal(context.forecast),
    manualWaterCreditInches,
    plantingWaterCreditInches,
    recentRainCreditInches,
    targetAmountInches,
    thresholdInches,
  });

  return {
    actionableDeficitInches,
    allowedDepletionInches,
    baselineDate,
    baselineSource,
    currentDepletionInches,
    dailyNeedInches,
    deficitBeforeForecastInches,
    elapsedDays,
    forecastCreditInches,
    manualWaterCreditInches,
    nextCheckReason,
    plantingWaterCreditInches,
    rawNeedInches: roundTo(rawNeedInches, 2),
    recentRainCreditInches,
    rootZoneCapacityInches,
    targetAmountInches,
    thresholdInches,
    waterBalance: {
      actionableDeficitInches,
      allowedDepletionInches,
      baselineDate,
      baselineSource,
      currentDepletionInches,
      dailyNeedInches,
      effectiveDeficitInches: deficitBeforeForecastInches,
      forecastCreditInches,
      manualWaterCreditInches,
      modelVersion: WATER_BALANCE_MODEL_VERSION,
      nextCheckReason,
      observedRainCreditInches: recentRainCreditInches,
      plantingWaterCreditInches,
      recentRainCreditInches,
      rootZoneCapacityInches,
      rootZoneCapacitySource: 'estimated',
      thresholdInches,
    },
  };
}

function getPlantingWaterBaseline(
  plantings: Planting[],
  now: Date,
  timezone: string,
): PlantingWaterBaseline {
  const today = formatLocalDate(now, timezone);
  const events = plantings.flatMap((planting) => {
    const directSowed = planting.plantingEvents
      .filter((event) => event.type === 'directSowed')
      .map((event) => ({
        occurredOn: event.occurredOn,
        source: 'plantingEvent' as const,
        type: event.type,
      }));
    const plantedOut = planting.plantingEvents
      .filter((event) => event.type === 'plantedOut')
      .map((event) => ({
        occurredOn: event.occurredOn,
        source: 'plantingEvent' as const,
        type: event.type,
      }));
    const plantedOn = planting.plantedOn
      ? [
          {
            occurredOn: planting.plantedOn,
            source: 'plantingRecord' as const,
            type: 'plantedOut' as const,
          },
        ]
      : [];

    return [...directSowed, ...plantedOut, ...plantedOn];
  });
  const latest = events.sort((left, right) =>
    right.occurredOn.localeCompare(left.occurredOn),
  )[0];

  if (!latest) {
    return {
      baselineDate: null,
      baselineSource: 'fallbackWeatherWindow',
      plantingWaterCreditInches: 0,
    };
  }

  return {
    baselineDate: latest.occurredOn,
    baselineSource: latest.source,
    plantingWaterCreditInches:
      latest.occurredOn === today
        ? latest.type === 'directSowed'
          ? DIRECT_SOW_WATER_CREDIT_INCHES
          : PLANTED_OUT_WATER_CREDIT_INCHES
        : 0,
  };
}

function getRecentRainCredit(
  context: WeatherWateringContext,
  target: WaterTarget,
  baselineDate: string,
) {
  const rawRainInches = getRecentRainSinceBaseline(context, baselineDate);
  return getLifecycleEffectiveRainCreditInches(rawRainInches, target);
}

function getRecentRainSinceBaseline(
  context: WeatherWateringContext,
  baselineDate: string,
) {
  const baselineMs = Date.parse(`${baselineDate}T00:00:00.000Z`);
  const observations = context.recentPrecipitation.observations.filter(
    (observation) => Date.parse(observation.observedAtIso) >= baselineMs,
  );

  if (observations.length > 0) {
    return observations.reduce(
      (total, observation) => total + observation.precipitationIn,
      0,
    );
  }

  const today = context.forecast.days[0]?.date;
  const elapsedDays = today ? daysBetweenLocalDates(baselineDate, today) : 3;

  return elapsedDays <= 1
    ? context.recentPrecipitation.last24hIn
    : context.recentPrecipitation.last72hIn;
}

function getForecastRainCredit(
  context: WeatherWateringContext,
  target: WaterTarget,
) {
  const expectedRainIn =
    context.forecast.days[0]?.expectedRainIn ??
    context.forecast.next24hPrecipIn ??
    0;

  return getLifecycleEffectiveRainCreditInches(expectedRainIn, target, 0.75);
}

function getDueThresholdInches(target: WaterTarget, dailyHighF: number | null) {
  return getLifecycleAllowedDepletionInches(target, dailyHighF);
}

function getNextCheckReason(input: {
  deficitBeforeForecastInches: number;
  forecastCreditInches: number;
  hasQualitativeRainSignal: boolean;
  manualWaterCreditInches: number;
  plantingWaterCreditInches: number;
  recentRainCreditInches: number;
  targetAmountInches: number;
  thresholdInches: number;
}) {
  if (input.plantingWaterCreditInches > 0) {
    return 'Planting-day watering is the current baseline.';
  }

  if (input.deficitBeforeForecastInches < input.thresholdInches) {
    return 'Recent rain or watering still covers the current plant need.';
  }

  if (input.forecastCreditInches >= input.deficitBeforeForecastInches) {
    return 'Forecast rain should cover the current deficit before watering.';
  }

  if (input.hasQualitativeRainSignal) {
    return 'NWS shows likely rain but has not published an inch amount yet; recheck after the rain window.';
  }

  if (input.manualWaterCreditInches > 0) {
    return 'Manual watering covered part of the current deficit.';
  }

  if (input.recentRainCreditInches > 0) {
    return 'Recent rain reduced the current deficit.';
  }

  return input.targetAmountInches > 0
    ? 'Dry weather has built a water deficit.'
    : 'No watering is due right now.';
}

function readWaterAmountInches(text: string) {
  const match = /\b(\d+(?:\.\d+)?)\s*(?:in|inch|inches)\b/i.exec(text);

  return match?.[1] ? Number(match[1]) : 0.25;
}

function getFrostRisk(overnightLowF: number | null) {
  if (overnightLowF === null) {
    return 'none';
  }

  if (overnightLowF <= 32) {
    return 'warning';
  }

  return overnightLowF <= 36 ? 'watch' : 'none';
}

function getHeatRisk(dailyHighF: number | null) {
  if (dailyHighF === null) {
    return 'none';
  }

  if (dailyHighF >= 95) {
    return 'warning';
  }

  return dailyHighF >= 88 ? 'watch' : 'none';
}

function getUrgency(
  deficitInches: number,
  dailyHighF: number | null,
  target: WaterTarget,
) {
  if (
    deficitInches >= 0.75 ||
    ((dailyHighF ?? 0) >= 95 &&
      deficitInches >= (target.isContainer ? 0.2 : 0.3))
  ) {
    return 'high';
  }

  if (deficitInches >= 0.4) {
    return 'medium';
  }

  return deficitInches >= 0.15 ? 'low' : 'none';
}

function getSuppressUntilIso(
  forecast: WeatherForecast,
  deficitInches: number,
  forecastCreditInches: number,
  thresholdInches: number,
  now: Date,
) {
  const nextRainIso = getFutureIso(forecast.nextRainIso, now);

  if (!nextRainIso) {
    return null;
  }

  if (forecastCreditInches + 0.05 >= deficitInches) {
    return nextRainIso;
  }

  const qualitativeCanWait =
    hasQualitativeRainSignal(forecast) &&
    deficitInches <= Math.max(thresholdInches + 0.25, 0.6);

  return qualitativeCanWait ? nextRainIso : null;
}

function getNextRecalculationAtIso(forecast: WeatherForecast, now: Date) {
  return (
    getFutureIso(forecast.nextRainIso, now) ??
    new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString()
  );
}

function hasQualitativeRainSignal(forecast: WeatherForecast) {
  return forecast.days.some(
    (day) =>
      day.rainLikely === true &&
      day.expectedRainIn < 0.01 &&
      day.rainSignalSource !== 'quantitativePrecipitation',
  );
}

function getFutureIso(value: string | null, now: Date) {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) || date < now ? null : value;
}

function buildRationale({
  balance,
  deficitInches,
  status,
  target,
  targetAmountInches,
  wateringCheckTime,
}: {
  balance: WaterBalanceCalculation;
  deficitInches: number;
  status: WateringScheduleEntry['status'];
  target: WaterTarget;
  targetAmountInches: number;
  wateringCheckTime: string;
}) {
  const rationale = [
    status === 'suppressed'
      ? balance.forecastCreditInches > 0
        ? `${target.label} can wait; forecast rain should cover about ${roundTo(deficitInches, 2)} in.`
        : `${target.label} can wait for the NWS rain window, then the water balance will be recalculated.`
      : status === 'scheduled'
        ? `${target.label} is lined up for the ${wateringCheckTime} watering check with about ${roundTo(targetAmountInches, 2)} in likely due.`
        : status === 'partial'
          ? `${target.label} still needs about ${roundTo(targetAmountInches, 2)} in after ${roundTo(balance.manualWaterCreditInches, 2)} in already logged.`
          : `${target.label} needs about ${roundTo(targetAmountInches, 2)} in soon.`,
    `Water balance started from ${balance.baselineDate}; demand since then is about ${roundTo(balance.rawNeedInches, 2)} in and root-zone depletion is about ${roundTo(balance.currentDepletionInches, 2)} in.`,
    `This target can use about ${roundTo(balance.rootZoneCapacityInches, 2)} in in the active root zone before excess water is ignored, with watering due at ${roundTo(balance.allowedDepletionInches, 2)} in depleted.`,
    `Credit counted: ${roundTo(balance.recentRainCreditInches, 2)} in effective rain, ${roundTo(balance.manualWaterCreditInches, 2)} in logged watering, and ${roundTo(balance.forecastCreditInches, 2)} in forecast rain.`,
    balance.nextCheckReason,
  ];

  if (balance.plantingWaterCreditInches > 0) {
    rationale.push(
      `This planting-day baseline counts ${roundTo(balance.plantingWaterCreditInches, 2)} in as already watered.`,
    );
  }

  if (balance.manualWaterCreditInches > 0) {
    rationale.push(
      `Logged watering already covered ${roundTo(balance.manualWaterCreditInches, 2)} in.`,
    );
  }

  if (balance.dailyNeedInches > target.weeklyWaterNeedInches / 7) {
    rationale.push('Heat is pushing the water need up.');
  }

  if (target.mulched) {
    rationale.push('Mulch is easing the demand a bit.');
  }

  if (target.soilType === 'sandy' || target.drainageProfile === 'fast') {
    rationale.push('Fast-draining soil means this area dries out faster.');
  }

  if (target.soilType === 'clay' || target.drainageProfile === 'slow') {
    rationale.push('Slower drainage trims the near-term water need.');
  }

  if (target.lifecycleStage === 'establishing') {
    rationale.push('New plantings need steadier moisture right now.');
  }

  if (target.lifecycleStage === 'mixed') {
    rationale.push(
      'This bed includes some newer plantings that dry out faster.',
    );
  }

  if (target.targetKind === 'bed' && target.memberCount > 1) {
    rationale.push(
      `This is rolled up for ${target.memberCount} active plantings in the same bed.`,
    );
  }

  if (target.irrigationZone) {
    rationale.push(`Water with ${target.irrigationZone}.`);
  }

  if (target.waterNeedSource === 'fallback') {
    rationale.push(
      'Crop-specific water data is thin here, so a conservative default was used.',
    );
  }

  if (status === 'suppressed') {
    rationale.push(
      'Keep this off the Today list until that rain window passes.',
    );
  } else if (status === 'scheduled') {
    rationale.push(`Bring this forward at ${wateringCheckTime}.`);
  } else {
    rationale.push(
      `Apply ${roundTo(targetAmountInches, 2)} in to close the current deficit.`,
    );
  }

  return rationale;
}

function combineWaterNeedSources(
  sources: PlantingWaterProfile[],
): WaterTarget['waterNeedSource'] {
  const sourceList = sources.map((source) => source.waterNeedSource);

  if (sourceList.includes('fallback')) {
    return 'fallback';
  }

  if (sourceList.includes('manual')) {
    return 'manual';
  }

  return 'cropProfile';
}

function getJournalEntryIso(createdAtIso: string, occurredOn: string) {
  return createdAtIso || `${occurredOn}T12:00:00.000Z`;
}

function buildForecastDays(
  forecast: WeatherForecast,
  timezone: string,
  observedForDate: string,
) {
  if (forecast.days.length > 0) {
    return forecast.days.slice(0, 14).map((day) => ({
      conditionSummary: day.conditionSummary,
      date: day.date,
      expectedRainIn: roundTo(day.expectedRainIn, 2),
      highF: day.highF,
      precipitationChancePercent: day.precipitationChancePercent,
      rainAmountSource: day.rainAmountSource,
      rainLikely: day.rainLikely,
      rainSignalSource: day.rainSignalSource,
      rainSummary: day.rainSummary,
      rainWindowEndIso: day.rainWindowEndIso,
      rainWindowStartIso: day.rainWindowStartIso,
    }));
  }

  if (forecast.periods.length === 0) {
    return [
      {
        conditionSummary: forecast.summary,
        date: observedForDate,
        expectedRainIn: roundTo(forecast.next24hPrecipIn, 2),
        highF: forecast.dailyHighF,
        precipitationChancePercent: null,
      },
      {
        conditionSummary: forecast.summary,
        date: addLocalDays(observedForDate, 1),
        expectedRainIn: roundTo(
          Math.max(forecast.next48hPrecipIn - forecast.next24hPrecipIn, 0),
          2,
        ),
        highF: forecast.dailyHighF,
        precipitationChancePercent: null,
      },
    ];
  }

  const days = new Map<
    string,
    {
      conditionSummaries: string[];
      expectedRainIn: number;
      highF: number | null;
      precipitationChancePercent: number | null;
    }
  >();

  forecast.periods.forEach((period) => {
    const date = formatLocalDate(new Date(period.startIso), timezone);
    const current = days.get(date) ?? {
      conditionSummaries: [],
      expectedRainIn: 0,
      highF: null,
      precipitationChancePercent: null,
    };

    current.conditionSummaries.push(period.shortForecast);
    current.expectedRainIn += period.precipitationAmountIn ?? 0;
    current.precipitationChancePercent =
      current.precipitationChancePercent === null
        ? period.precipitationChancePercent
        : period.precipitationChancePercent === null
          ? current.precipitationChancePercent
          : Math.max(
              current.precipitationChancePercent,
              period.precipitationChancePercent,
            );
    current.highF =
      current.highF === null
        ? period.temperatureF
        : period.temperatureF === null
          ? current.highF
          : Math.max(current.highF, period.temperatureF);
    days.set(date, current);
  });

  return [...days.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .slice(0, 14)
    .map(([date, day]) => ({
      conditionSummary: day.conditionSummaries[0] ?? forecast.summary,
      date,
      expectedRainIn: roundTo(day.expectedRainIn, 2),
      highF: day.highF,
      precipitationChancePercent: day.precipitationChancePercent,
    }));
}

function getWeatherDataQuality(context: WeatherWateringContext) {
  const missingSignals = [
    context.currentConditions.temperatureF === null,
    context.forecast.periods.length === 0,
    context.recentPrecipitation.generatedAtIso === '',
  ].filter(Boolean).length;

  if (missingSignals === 0) {
    return 'complete';
  }

  return missingSignals === 1 ? 'partial' : 'limited';
}

function getRecommendationDataQuality(
  context: WeatherWateringContext,
  target: WaterTarget,
) {
  if (target.waterNeedSource === 'fallback') {
    return 'limited';
  }

  return getWeatherDataQuality(context);
}

function toWeatherLocation(location: GardenLocation): WeatherLocation {
  return {
    latitude: location.latitude ?? detroitLocation.latitude ?? 42.3314,
    locationName: location.locationName || detroitLocation.locationName,
    longitude: location.longitude ?? detroitLocation.longitude ?? -83.0458,
    timezone: location.timezone || detroitLocation.timezone,
  };
}

function formatLocalDate(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    day: '2-digit',
    month: '2-digit',
    timeZone: timezone,
    year: 'numeric',
  }).formatToParts(date);
  const year = parts.find((part) => part.type === 'year')?.value ?? '1970';
  const month = parts.find((part) => part.type === 'month')?.value ?? '01';
  const day = parts.find((part) => part.type === 'day')?.value ?? '01';

  return `${year}-${month}-${day}`;
}

function isBeforeWateringCheck(
  date: Date,
  timezone: string,
  wateringCheckTime: string,
) {
  return getLocalMinutes(date, timezone) < parseLocalTime(wateringCheckTime);
}

function resolveWateringCheckWindowStartIso(
  localDate: string,
  timezone: string,
  wateringCheckTime: string,
) {
  const midnightUtcMs = Date.parse(`${localDate}T00:00:00.000Z`);
  const localMinutes = parseLocalTime(wateringCheckTime);
  const candidate = new Date(midnightUtcMs + localMinutes * 60_000);
  const offsetMinutes = getTimeZoneOffsetMinutes(candidate, timezone);

  return new Date(
    midnightUtcMs + (localMinutes - offsetMinutes) * 60_000,
  ).toISOString();
}

function getLocalMinutes(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    hour: '2-digit',
    hourCycle: 'h23',
    minute: '2-digit',
    timeZone: timezone,
  }).formatToParts(date);
  const hour = Number(parts.find((part) => part.type === 'hour')?.value ?? 0);
  const minute = Number(
    parts.find((part) => part.type === 'minute')?.value ?? 0,
  );

  return hour * 60 + minute;
}

function parseLocalTime(value: string) {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());

  if (!match) {
    return 7 * 60;
  }

  const hours = Math.min(Math.max(Number(match[1]), 0), 23);
  const minutes = Math.min(Math.max(Number(match[2]), 0), 59);
  return hours * 60 + minutes;
}

function getTimeZoneOffsetMinutes(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23',
    minute: '2-digit',
    month: '2-digit',
    second: '2-digit',
    timeZone: timezone,
    year: 'numeric',
  }).formatToParts(date);
  const year = Number(parts.find((part) => part.type === 'year')?.value ?? 0);
  const month =
    Number(parts.find((part) => part.type === 'month')?.value ?? 1) - 1;
  const day = Number(parts.find((part) => part.type === 'day')?.value ?? 1);
  const hour = Number(parts.find((part) => part.type === 'hour')?.value ?? 0);
  const minute = Number(
    parts.find((part) => part.type === 'minute')?.value ?? 0,
  );
  const second = Number(
    parts.find((part) => part.type === 'second')?.value ?? 0,
  );

  return (
    (Date.UTC(year, month, day, hour, minute, second) - date.getTime()) / 60_000
  );
}

function roundTo(value: number, decimals: number) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function addLocalDays(localDate: string, days: number) {
  const parsedDate = new Date(`${localDate}T12:00:00.000Z`);
  parsedDate.setUTCDate(parsedDate.getUTCDate() + days);
  return parsedDate.toISOString().slice(0, 10);
}

function daysBetweenLocalDates(startDate: string, endDate: string) {
  const startMs = Date.parse(`${startDate}T12:00:00.000Z`);
  const endMs = Date.parse(`${endDate}T12:00:00.000Z`);

  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) {
    return 0;
  }

  return Math.floor((endMs - startMs) / (24 * 60 * 60 * 1000));
}
