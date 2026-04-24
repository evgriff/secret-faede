import type {
  Garden,
  UserProfile,
  WeatherSnapshot,
} from '../../domain/gardens/GardenRepository';
import type { WeatherProvider } from '../../domain/weather/WeatherProvider';
import { synchronizeGardenTasks } from '../tasks/taskEngine';
import {
  buildWateringSchedule,
  createWeatherSnapshot,
  loadWeatherWateringContext,
  mergeWateringSchedule,
  type WateringScheduleDefaults,
  type WeatherWateringContext,
} from './wateringEngine';

interface WateringRefreshOptions {
  now?: Date;
  preserveDueWindowStart?: boolean;
  profile?: UserProfile | null;
  syncTasks?: boolean;
}

interface LiveWeatherRefreshOptions extends WateringRefreshOptions {
  includeNotificationLogs?: boolean;
}

export function resolveWateringScheduleDefaults(
  garden: Garden,
  profile?: UserProfile | null,
): WateringScheduleDefaults {
  return {
    defaultWateringCheckTime:
      profile?.notificationPreference.defaultWateringCheckTime ?? '07:00',
    timezone:
      profile?.notificationPreference.timezone ??
      profile?.timezone ??
      garden.plot.location.timezone,
  };
}

export function rebuildGardenWateringFromLatestSnapshot(
  garden: Garden,
  options: WateringRefreshOptions = {},
): Garden {
  const now = options.now ?? new Date();
  const latestSnapshot = getLatestWeatherSnapshot(garden);

  if (!latestSnapshot) {
    return syncGardenTasks(garden, now, options.syncTasks);
  }

  const wateringSchedule = buildWateringSchedule(
    garden,
    createWeatherContextFromSnapshot(latestSnapshot),
    latestSnapshot,
    now,
    resolveWateringScheduleDefaults(garden, options.profile),
  );
  const updatedGarden = {
    ...garden,
    updatedAtIso: now.toISOString(),
    wateringSchedule: mergeWateringSchedule(
      garden.wateringSchedule,
      wateringSchedule,
      options.preserveDueWindowStart === undefined
        ? {}
        : {
            preserveDueWindowStart: options.preserveDueWindowStart,
          },
    ),
  };

  return syncGardenTasks(updatedGarden, now, options.syncTasks);
}

export async function refreshGardenWateringFromWeather(
  garden: Garden,
  weatherProvider: WeatherProvider,
  options: LiveWeatherRefreshOptions = {},
): Promise<Garden> {
  const now = options.now ?? new Date();
  const context = await loadWeatherWateringContext(
    weatherProvider,
    garden.plot.location,
  );
  const snapshot = createWeatherSnapshot(garden, context, now);
  const wateringSchedule = buildWateringSchedule(
    garden,
    context,
    snapshot,
    now,
    resolveWateringScheduleDefaults(garden, options.profile),
  );
  const notificationLogs =
    options.includeNotificationLogs === false
      ? garden.notificationLogs
      : await buildNotificationLogs(garden, wateringSchedule, snapshot, now);
  const updatedGarden = {
    ...garden,
    notificationLogs,
    updatedAtIso: now.toISOString(),
    wateringSchedule: mergeWateringSchedule(
      garden.wateringSchedule,
      wateringSchedule,
      options.preserveDueWindowStart === undefined
        ? {}
        : {
            preserveDueWindowStart: options.preserveDueWindowStart,
          },
    ),
    weatherSnapshots: [...garden.weatherSnapshots, snapshot].slice(-8),
  };

  return syncGardenTasks(updatedGarden, now, options.syncTasks);
}

function getLatestWeatherSnapshot(garden: Garden): WeatherSnapshot | null {
  return (
    [...garden.weatherSnapshots].sort((left, right) =>
      right.capturedAtIso.localeCompare(left.capturedAtIso),
    )[0] ?? null
  );
}

function createWeatherContextFromSnapshot(
  snapshot: WeatherSnapshot,
): WeatherWateringContext {
  const providerId =
    snapshot.source === 'tomorrowIo' ? 'tomorrowIo' : 'nationalWeatherService';
  const sourceLabel =
    snapshot.providerLabel ??
    (providerId === 'tomorrowIo' ? 'Tomorrow.io' : 'National Weather Service');

  return {
    agricultureMetrics: {
      evapotranspirationIn: snapshot.evapotranspirationIn,
      evapotranspirationNext24hIn: snapshot.evapotranspirationIn,
      generatedAtIso: snapshot.capturedAtIso,
      notes: [],
      providerId,
    },
    alerts: [],
    currentConditions: {
      capturedAtIso: snapshot.capturedAtIso,
      conditionSummary: snapshot.conditionSummary,
      feelsLikeF: snapshot.temperatureF,
      humidityPercent: snapshot.humidityPercent,
      observationTimeIso: snapshot.capturedAtIso,
      precipitationLastHourIn: null,
      providerId,
      sourceLabel,
      temperatureF: snapshot.temperatureF,
      windMph: snapshot.windMph,
    },
    forecast: {
      dailyHighF: snapshot.temperatureF,
      generatedAtIso: snapshot.capturedAtIso,
      next24hPrecipIn: snapshot.forecastRainNext24In ?? 0,
      next48hPrecipIn: snapshot.forecastRainNext48In ?? 0,
      nextRainIso: snapshot.nextRainIso,
      overnightLowF: snapshot.overnightLowF,
      periods: [],
      providerId,
      summary: snapshot.conditionSummary,
    },
    recentPrecipitation: {
      generatedAtIso: snapshot.capturedAtIso,
      hours: 72,
      last24hIn: snapshot.precipitationIn ?? 0,
      last72hIn: snapshot.recentPrecipitation72hIn ?? 0,
      observations: [],
      providerId,
      totalIn: snapshot.precipitationIn ?? 0,
    },
  };
}

async function buildNotificationLogs(
  garden: Garden,
  wateringSchedule: Garden['wateringSchedule'],
  snapshot: WeatherSnapshot,
  now: Date,
) {
  const { buildInAppNotificationLogs } =
    await import('./notificationDecisions');
  return [
    ...garden.notificationLogs,
    ...buildInAppNotificationLogs(garden, wateringSchedule, snapshot, now),
  ].slice(-60);
}

function syncGardenTasks(garden: Garden, now: Date, syncTasks = true) {
  return syncTasks
    ? synchronizeGardenTasks(garden, {
        now,
        refreshOpenGenerated: true,
      })
    : garden;
}
