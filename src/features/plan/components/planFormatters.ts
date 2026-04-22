import type {
  Planting,
  StructureType,
  WaterRecommendation,
  WeatherSnapshot,
} from '../../../domain/gardens/GardenRepository';
import type { SunSeason } from '../../garden/sunShadeEngine';

export function formatNullableInches(value: number | null) {
  return value === null ? '-' : `${value} in`;
}

export function readOptionalNumber(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function formatMode(mode: Planting['mode']) {
  return mode
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (letter) => letter.toUpperCase());
}

export function formatSun(value: Planting['sunRequirement']) {
  return value
    ? value
        .replace(/([A-Z])/g, ' $1')
        .replace(/^./, (letter) => letter.toUpperCase())
    : '-';
}

export function formatStructureType(type: StructureType) {
  if (type === 'treeObstacle') {
    return 'Legacy shade source';
  }

  return type
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (letter) => letter.toUpperCase());
}

export function getLatestWeatherSnapshot(snapshots: WeatherSnapshot[]) {
  return [...snapshots].sort((left, right) =>
    right.capturedAtIso.localeCompare(left.capturedAtIso),
  )[0];
}

export function formatWeatherSummary(snapshot: WeatherSnapshot | undefined) {
  if (!snapshot) {
    return 'Not updated';
  }

  const temperature =
    snapshot.temperatureF === null
      ? ''
      : `, ${Math.round(snapshot.temperatureF)}F`;

  return `${snapshot.conditionSummary || 'Observed'}${temperature}`;
}

export function formatNextRain(snapshot: WeatherSnapshot | undefined) {
  if (!snapshot) {
    return 'Unknown';
  }

  if (!snapshot.nextRainIso) {
    return `${formatNullableInches(snapshot.forecastRainNext24In)} next 24h`;
  }

  return `${formatNullableInches(snapshot.forecastRainNext24In)} by ${formatShortDateTime(
    snapshot.nextRainIso,
  )}`;
}

export function formatAlerts(snapshot: WeatherSnapshot | undefined) {
  if (!snapshot || snapshot.alertSummaries.length === 0) {
    return 'None active';
  }

  return (
    snapshot.alertSummaries[0] ?? `${snapshot.alertSummaries.length} alerts`
  );
}

export function formatWateringSummary(recommendations: WaterRecommendation[]) {
  const activeCount = recommendations.filter(
    (recommendation) => recommendation.status !== 'suppressed',
  ).length;
  const suppressedCount = recommendations.length - activeCount;

  if (activeCount > 0) {
    return `${activeCount} today`;
  }

  return suppressedCount > 0 ? `${suppressedCount} after rain` : 'None today';
}

export function formatRecommendationAmount(
  recommendation: WaterRecommendation,
) {
  if (recommendation.status === 'suppressed') {
    return `wait until ${formatShortDateTime(recommendation.suppressUntilIso)}`;
  }

  return `${recommendation.recommendedWaterInches.toFixed(2)} in`;
}

export function formatUrgency(urgency: WaterRecommendation['urgency']) {
  return urgency
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (letter) => letter.toUpperCase());
}

export function formatShortDateTime(value: string | null) {
  if (!value) {
    return 'later';
  }

  return new Intl.DateTimeFormat(undefined, {
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    month: 'short',
  }).format(new Date(value));
}

export function formatSeason(season: SunSeason) {
  return season.replace(/^./, (letter) => letter.toUpperCase());
}
