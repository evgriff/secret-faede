import { getCropById } from '../../domain/crops/cropCatalog';
import {
  annArborLocation,
  type DrainageProfile,
  type Garden,
  type GardenLocation,
  type Planting,
  type SoilType,
  type Structure,
  type WaterRecommendation,
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

interface WaterTarget {
  drainageProfile: DrainageProfile;
  id: string;
  irrigationZone: string | null;
  label: string;
  mulched: boolean;
  soilType: SoilType;
  targetType: 'bed' | 'planting';
  waterNeedSource: 'cropProfile' | 'fallback' | 'manual';
  weeklyWaterNeedInches: number;
}

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

export function buildWaterRecommendations(
  garden: Garden,
  context: WeatherWateringContext,
  snapshot: WeatherSnapshot,
  now = new Date(),
): WaterRecommendation[] {
  const recommendationDate = formatLocalDate(
    now,
    garden.plot.location.timezone,
  );
  const forecastCredit = Math.min(context.forecast.next24hPrecipIn * 0.6, 0.75);
  const effectiveRainIn =
    context.recentPrecipitation.last72hIn + forecastCredit;
  const heatMultiplier = getHeatMultiplier(context.forecast.dailyHighF);
  const etAdjustment = Math.min(
    context.agricultureMetrics.evapotranspirationNext24hIn ?? 0,
    0.35,
  );

  return getWaterTargets(garden).flatMap((target): WaterRecommendation[] => {
    const manualWaterIn = estimateManualWateringIn(garden, target, now);
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
    const deficitInches = Math.max(
      adjustedNeedInches - effectiveRainIn - manualWaterIn,
      0,
    );

    if (deficitInches < 0.15) {
      return [];
    }

    const suppressUntilIso = getSuppressUntilIso(
      context.forecast,
      deficitInches,
    );
    const status = suppressUntilIso ? 'suppressed' : 'active';
    const recommendedWaterInches =
      status === 'suppressed' ? 0 : roundTo(deficitInches, 2);
    const urgency = getUrgency(deficitInches, context.forecast.dailyHighF);
    const rationale = buildRationale({
      adjustedNeedInches,
      deficitInches,
      effectiveRainIn,
      forecastCredit,
      heatMultiplier,
      manualWaterIn,
      mulched: target.mulched,
      recommendedWaterInches,
      status,
      target,
    });

    return [
      {
        deficitInches: roundTo(deficitInches, 2),
        generatedAtIso: now.toISOString(),
        generatedBy: 'client',
        gardenId: garden.id,
        id: `water-${target.targetType}-${target.id}-${recommendationDate}`,
        inchesNeeded: recommendedWaterInches,
        plantingId: target.targetType === 'planting' ? target.id : null,
        rationale,
        reason: rationale[0] ?? 'Water deficit detected.',
        recommendationDate,
        recommendedWaterInches,
        refreshedAtIso: now.toISOString(),
        status,
        suppressUntilIso,
        targetId: target.id,
        targetLabel: target.label,
        targetType: target.targetType,
        urgency,
        dataQuality: getRecommendationDataQuality(context, target),
        weatherSnapshotId: snapshot.id,
      },
    ];
  });
}

function getWaterTargets(garden: Garden): WaterTarget[] {
  return [
    ...garden.plantings
      .filter((planting) => planting.status !== 'removed')
      .map((planting) => createPlantingTarget(garden, planting)),
    ...garden.structures.flatMap((structure): WaterTarget[] =>
      isWaterableBed(structure) ? [createBedTarget(garden, structure)] : [],
    ),
  ];
}

function createPlantingTarget(garden: Garden, planting: Planting): WaterTarget {
  const crop = getCropById(planting.cropId);
  const structure = getPlantingStructure(garden, planting);
  const containerMultiplier = getStructureWaterMultiplier(structure);
  const source = planting.weeklyWaterNeedInches
    ? 'manual'
    : crop?.weeklyWaterNeedInches
      ? 'cropProfile'
      : 'fallback';
  const weeklyWaterNeedInches =
    planting.weeklyWaterNeedInches ??
    crop?.weeklyWaterNeedInches ??
    fallbackCropWaterNeed(crop?.waterNeeds ?? null);

  return {
    drainageProfile: structure?.drainageProfile ?? 'unknown',
    id: planting.id,
    irrigationZone:
      planting.irrigationZone ?? structure?.irrigationZone ?? null,
    label: planting.label,
    mulched: planting.mulched,
    soilType: structure?.soilType ?? 'unknown',
    targetType: 'planting',
    waterNeedSource: source,
    weeklyWaterNeedInches: weeklyWaterNeedInches * containerMultiplier,
  };
}

function createBedTarget(garden: Garden, structure: Structure): WaterTarget {
  const bedPlantings = garden.plantings.filter((planting) =>
    isPointInsideStructure(planting.xFt, planting.yFt, structure),
  );
  const averageCropNeed =
    bedPlantings.length > 0
      ? bedPlantings.reduce(
          (total, planting) =>
            total +
            (planting.weeklyWaterNeedInches ??
              getCropById(planting.cropId)?.weeklyWaterNeedInches ??
              1),
          0,
        ) / bedPlantings.length
      : 1;
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
    mulched: structure.mulched,
    soilType: structure.soilType ?? 'unknown',
    targetType: 'bed',
    waterNeedSource: bedPlantings.length > 0 ? 'cropProfile' : 'fallback',
    weeklyWaterNeedInches: averageCropNeed * bedMultiplier,
  };
}

function getPlantingStructure(garden: Garden, planting: Planting) {
  return garden.structures.find((candidate) =>
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

function estimateManualWateringIn(
  garden: Garden,
  target: WaterTarget,
  now: Date,
) {
  const targetText = target.label.toLowerCase();
  const start = new Date(now.getTime() - 72 * 60 * 60 * 1000);

  return garden.journalEntries.reduce((total, entry) => {
    const entryDate = new Date(entry.occurredOn);
    const text = `${entry.title} ${entry.body}`.toLowerCase();

    if (
      Number.isNaN(entryDate.getTime()) ||
      entryDate < start ||
      !text.includes('water') ||
      (!text.includes(targetText) && !text.includes('garden'))
    ) {
      return total;
    }

    return total + readWaterAmountInches(text);
  }, 0);
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
  if (!forecast.nextRainIso || forecast.next24hPrecipIn < deficitInches) {
    return null;
  }

  return forecast.nextRainIso;
}

function buildRationale({
  adjustedNeedInches,
  deficitInches,
  effectiveRainIn,
  forecastCredit,
  heatMultiplier,
  manualWaterIn,
  mulched,
  recommendedWaterInches,
  status,
  target,
}: {
  adjustedNeedInches: number;
  deficitInches: number;
  effectiveRainIn: number;
  forecastCredit: number;
  heatMultiplier: number;
  manualWaterIn: number;
  mulched: boolean;
  recommendedWaterInches: number;
  status: WaterRecommendation['status'];
  target: WaterTarget;
}) {
  const rationale = [
    `${target.label} needs about ${roundTo(adjustedNeedInches, 2)} in/week after crop, bed, mulch, and heat adjustments.`,
    `Recent rain plus near-term forecast credit covers ${roundTo(effectiveRainIn, 2)} in.`,
  ];

  if (manualWaterIn > 0) {
    rationale.push(`Manual watering logs add ${roundTo(manualWaterIn, 2)} in.`);
  }

  if (heatMultiplier > 1) {
    rationale.push('Heat stress increased the water target.');
  }

  if (mulched) {
    rationale.push('Mulch reduced the water target.');
  }

  if (target.soilType === 'sandy' || target.drainageProfile === 'fast') {
    rationale.push('Fast-draining conditions increased the water target.');
  }

  if (target.soilType === 'clay' || target.drainageProfile === 'slow') {
    rationale.push('Slow-draining conditions reduced the water target.');
  }

  if (target.irrigationZone) {
    rationale.push(`Assigned irrigation zone: ${target.irrigationZone}.`);
  }

  if (target.waterNeedSource === 'fallback') {
    rationale.push(
      'Crop-specific water data is incomplete, so a conservative default was used.',
    );
  }

  if (status === 'suppressed') {
    rationale.push(
      `Rain is expected soon, so the ${roundTo(deficitInches, 2)} in deficit is suppressed until the forecast rain window.`,
    );
  } else {
    rationale.push(
      `Apply ${roundTo(recommendedWaterInches, 2)} in to close the current deficit.`,
    );
  }

  if (forecastCredit > 0) {
    rationale.push(
      `${roundTo(forecastCredit, 2)} in of forecast rain is counted at partial credit.`,
    );
  }

  return rationale;
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

function roundTo(value: number, decimals: number) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}
