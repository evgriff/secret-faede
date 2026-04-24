import { getCropById } from '../../domain/crops/cropCatalog';
import {
  annArborLocation,
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
} from '../../domain/weather/WeatherProvider';
import { getStructureFootprint } from './gardenPlanning';

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
  label: string;
  lifecycleStage: 'establishing' | 'mixed' | 'steady';
  memberCount: number;
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

const ACTIVE_WATERING_STATUSES = new Set([
  'growing',
  'harvest-ready',
  'planted',
]);
const MIN_ACTIONABLE_DEFICIT_INCHES = 0.15;

export async function loadWeatherWateringContext(
  provider: WeatherProvider,
  gardenLocation: GardenLocation,
): Promise<WeatherWateringContext> {
  const location = toWeatherLocation(gardenLocation);
  const [
    currentConditions,
    forecast,
    alerts,
    recentPrecipitation,
    agricultureMetrics,
  ] = await Promise.all([
    provider.getCurrentConditions(location),
    provider.getForecast(location),
    provider.getWeatherAlerts(location),
    provider.getRecentPrecipitation(location, 72),
    provider.getOptionalAgricultureMetrics(location),
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
  const forecastCredit = Math.min(context.forecast.next24hPrecipIn * 0.6, 0.75);
  const recentRainIn = context.recentPrecipitation.last72hIn;
  const heatMultiplier = getHeatMultiplier(context.forecast.dailyHighF);
  const etAdjustment = Math.min(
    context.agricultureMetrics.evapotranspirationNext24hIn ?? 0,
    0.35,
  );

  return getWaterTargets(garden).flatMap((target): WateringScheduleEntry[] => {
    const manualWateringHistory = estimateManualWatering(garden, target, now);
    const manualWaterIn = manualWateringHistory.appliedAmountInches;
    const mulchMultiplier = target.mulched ? 0.85 : 1;
    const soilMultiplier = getSoilMultiplier(target.soilType);
    const drainageMultiplier = getDrainageMultiplier(target.drainageProfile);
    const adjustedNeedInches =
      target.weeklyWaterNeedInches *
        heatMultiplier *
        mulchMultiplier *
        soilMultiplier *
        drainageMultiplier +
      etAdjustment;
    const remainingBeforeForecastInches = Math.max(
      adjustedNeedInches - recentRainIn - manualWaterIn,
      0,
    );
    const remainingAfterForecastInches = Math.max(
      remainingBeforeForecastInches - forecastCredit,
      0,
    );
    const manualCreditInches = roundTo(
      Math.min(manualWaterIn, adjustedNeedInches),
      2,
    );
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

    if (
      remainingBeforeForecastInches < MIN_ACTIONABLE_DEFICIT_INCHES &&
      manualCreditInches <= 0
    ) {
      return [];
    }

    const suppressUntilIso = getSuppressUntilIso(
      context.forecast,
      remainingBeforeForecastInches,
    );
    let status: WateringScheduleEntry['status'];
    let targetAmountInches = 0;
    let deficitInches = 0;

    if (remainingBeforeForecastInches < MIN_ACTIONABLE_DEFICIT_INCHES) {
      status = 'completed';
    } else if (suppressUntilIso) {
      status = 'suppressed';
      deficitInches = roundTo(remainingBeforeForecastInches, 2);
    } else if (remainingAfterForecastInches < MIN_ACTIONABLE_DEFICIT_INCHES) {
      if (manualCreditInches <= 0) {
        return [];
      }

      status = 'completed';
    } else {
      status = isBeforeWateringCheck(now, scheduleTimezone, wateringCheckTime)
        ? 'scheduled'
        : manualCreditInches > 0
          ? 'partial'
          : 'due';
      targetAmountInches = roundTo(remainingAfterForecastInches, 2);
      deficitInches = targetAmountInches;
    }

    const urgency = getUrgency(
      status === 'suppressed' ? deficitInches : targetAmountInches,
      context.forecast.dailyHighF,
    );
    const rationale = buildRationale({
      adjustedNeedInches,
      deficitInches,
      forecastCredit,
      heatMultiplier,
      manualWaterIn,
      mulched: target.mulched,
      recentRainIn,
      targetAmountInches,
      status,
      target,
      wateringCheckTime,
    });

    return [
      {
        appliedAmountInches: manualCreditInches > 0 ? manualCreditInches : null,
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
        wateringZoneId: target.irrigationZone,
        weatherSnapshotId: snapshot.id,
      },
    ];
  });
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

function getWaterTargets(garden: Garden): WaterTarget[] {
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
        ? [createBedTarget(structure, structurePlantings)]
        : [];
    }),
    ...standalonePlantings.map(({ planting, structure }) =>
      createPlantingTarget(planting, structure),
    ),
  ];
}

function createPlantingTarget(
  planting: Planting,
  structure: Structure | undefined,
): WaterTarget {
  const containerMultiplier = getStructureWaterMultiplier(structure);
  const waterProfile = getPlantingWaterProfile(planting);

  return {
    drainageProfile: structure?.drainageProfile ?? 'unknown',
    id: planting.id,
    irrigationZone:
      planting.irrigationZone ?? structure?.irrigationZone ?? null,
    label: planting.label,
    lifecycleStage: waterProfile.lifecycleStage,
    memberCount: 1,
    mulched: planting.mulched,
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
): WaterTarget {
  const plantWaterProfiles = bedPlantings.map(getPlantingWaterProfile);
  const averageCropNeed =
    plantWaterProfiles.reduce(
      (total, profile) => total + profile.weeklyWaterNeedInches,
      0,
    ) / plantWaterProfiles.length;
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
    label: structure.label,
    lifecycleStage: getTargetLifecycleStage(bedPlantings),
    memberCount: bedPlantings.length,
    mulched: structure.mulched,
    soilType: structure.soilType ?? 'unknown',
    targetKind: 'bed',
    waterNeedSource: combineWaterNeedSources(
      plantWaterProfiles.map((profile) => profile.waterNeedSource),
    ),
    weeklyWaterNeedInches: averageCropNeed * bedMultiplier,
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
  const start = new Date(now.getTime() - 72 * 60 * 60 * 1000);

  return garden.journalEntries.reduce<ManualWateringHistory>(
    (history, entry) => {
      const entryIso = getJournalEntryIso(entry.createdAtIso, entry.occurredOn);
      const entryDate = new Date(entryIso);
      const text = `${entry.title} ${entry.body}`.toLowerCase();
      const directMatch =
        target.targetKind === 'planting'
          ? entry.plantingId === target.id
          : entry.structureId === target.id;
      const labelMatch =
        entry.targetLabel.toLowerCase() === targetText ||
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

function getHeatMultiplier(dailyHighF: number | null) {
  if (dailyHighF === null) {
    return 1;
  }

  if (dailyHighF >= 95) {
    return 1.3;
  }

  if (dailyHighF >= 88) {
    return 1.15;
  }

  return dailyHighF >= 82 ? 1.05 : 1;
}

function getSoilMultiplier(soilType: SoilType) {
  if (soilType === 'sandy') {
    return 1.12;
  }

  if (soilType === 'clay') {
    return 0.94;
  }

  return 1;
}

function getDrainageMultiplier(drainageProfile: DrainageProfile) {
  if (drainageProfile === 'fast') {
    return 1.12;
  }

  if (drainageProfile === 'slow') {
    return 0.92;
  }

  return 1;
}

function getUrgency(deficitInches: number, dailyHighF: number | null) {
  if (deficitInches >= 0.75 || (dailyHighF ?? 0) >= 95) {
    return 'high';
  }

  if (deficitInches >= 0.4) {
    return 'medium';
  }

  return deficitInches >= 0.15 ? 'low' : 'none';
}

function getSuppressUntilIso(forecast: WeatherForecast, deficitInches: number) {
  if (!forecast.nextRainIso || forecast.next24hPrecipIn + 0.1 < deficitInches) {
    return null;
  }

  return forecast.nextRainIso;
}

function getNextRecalculationAtIso(forecast: WeatherForecast, now: Date) {
  return (
    forecast.nextRainIso ??
    new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString()
  );
}

function buildRationale({
  adjustedNeedInches,
  deficitInches,
  forecastCredit,
  heatMultiplier,
  manualWaterIn,
  mulched,
  recentRainIn,
  targetAmountInches,
  status,
  target,
  wateringCheckTime,
}: {
  adjustedNeedInches: number;
  deficitInches: number;
  forecastCredit: number;
  heatMultiplier: number;
  manualWaterIn: number;
  mulched: boolean;
  recentRainIn: number;
  status: WateringScheduleEntry['status'];
  target: WaterTarget;
  targetAmountInches: number;
  wateringCheckTime: string;
}) {
  const rationale = [
    status === 'completed'
      ? `${target.label} is covered for now after ${roundTo(manualWaterIn, 2)} in already logged.`
      : status === 'suppressed'
        ? `${target.label} can wait; rain due soon should cover about ${roundTo(deficitInches, 2)} in.`
        : status === 'scheduled'
          ? `${target.label} is lined up for the ${wateringCheckTime} watering check with about ${roundTo(targetAmountInches, 2)} in likely due.`
          : status === 'partial'
            ? `${target.label} still needs about ${roundTo(targetAmountInches, 2)} in after ${roundTo(manualWaterIn, 2)} in already logged.`
            : `${target.label} needs about ${roundTo(targetAmountInches, 2)} in soon.`,
    `Adjusted need is about ${roundTo(adjustedNeedInches, 2)} in this week.`,
    `Rain credit: ${roundTo(recentRainIn, 2)} in recent and ${roundTo(forecastCredit, 2)} in forecast.`,
  ];

  if (manualWaterIn > 0) {
    rationale.push(
      `Logged watering already covered ${roundTo(manualWaterIn, 2)} in.`,
    );
  }

  if (heatMultiplier > 1) {
    rationale.push('Heat is pushing the water need up.');
  }

  if (mulched) {
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
  } else if (status === 'completed') {
    rationale.push('No more watering is due right now.');
  } else if (status === 'scheduled') {
    rationale.push(`Bring this forward at ${wateringCheckTime}.`);
  } else {
    rationale.push(
      `Apply ${roundTo(targetAmountInches, 2)} in to close the current deficit.`,
    );
  }

  return rationale;
}

function getPlantingWaterProfile(planting: Planting): {
  lifecycleStage: Exclude<WaterTarget['lifecycleStage'], 'mixed'>;
  waterNeedSource: WaterTarget['waterNeedSource'];
  weeklyWaterNeedInches: number;
} {
  const crop = getCropById(planting.cropId);
  const waterNeedSource: WaterTarget['waterNeedSource'] =
    planting.weeklyWaterNeedInches
      ? 'manual'
      : crop?.weeklyWaterNeedInches
        ? 'cropProfile'
        : 'fallback';
  const weeklyWaterNeedInches =
    (planting.weeklyWaterNeedInches ??
      crop?.weeklyWaterNeedInches ??
      fallbackCropWaterNeed(crop?.waterNeeds ?? null)) *
    getLifecycleWaterMultiplier(planting);

  return {
    lifecycleStage:
      planting.status === 'planted'
        ? ('establishing' as const)
        : ('steady' as const),
    waterNeedSource,
    weeklyWaterNeedInches,
  };
}

function getLifecycleWaterMultiplier(planting: Planting) {
  if (planting.status === 'planted') {
    return 1.15;
  }

  if (planting.status === 'harvest-ready') {
    return 1.05;
  }

  return 1;
}

function getTargetLifecycleStage(
  plantings: Planting[],
): WaterTarget['lifecycleStage'] {
  const establishingCount = plantings.filter(
    (planting) => planting.status === 'planted',
  ).length;

  if (establishingCount === 0) {
    return 'steady';
  }

  if (establishingCount === plantings.length) {
    return 'establishing';
  }

  return 'mixed';
}

function combineWaterNeedSources(
  sources: WaterTarget['waterNeedSource'][],
): WaterTarget['waterNeedSource'] {
  if (sources.includes('fallback')) {
    return 'fallback';
  }

  if (sources.includes('manual')) {
    return 'manual';
  }

  return 'cropProfile';
}

function getJournalEntryIso(createdAtIso: string, occurredOn: string) {
  return createdAtIso || `${occurredOn}T12:00:00.000Z`;
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

function fallbackCropWaterNeed(waterNeeds: 'high' | 'low' | 'medium' | null) {
  if (waterNeeds === 'high') {
    return 1.25;
  }

  if (waterNeeds === 'low') {
    return 0.6;
  }

  return 1;
}

function toWeatherLocation(location: GardenLocation): WeatherLocation {
  return {
    latitude: location.latitude ?? annArborLocation.latitude ?? 42.3314,
    locationName: location.locationName || annArborLocation.locationName,
    longitude: location.longitude ?? annArborLocation.longitude ?? -83.0458,
    timezone: location.timezone || annArborLocation.timezone,
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
