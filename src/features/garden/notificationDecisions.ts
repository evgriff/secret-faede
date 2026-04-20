import type {
  Garden,
  NotificationLog,
  WaterRecommendation,
  WeatherSnapshot,
} from '../../domain/gardens/GardenRepository';

export function buildInAppNotificationLogs(
  garden: Garden,
  recommendations: WaterRecommendation[],
  snapshot: WeatherSnapshot,
  now = new Date(),
): NotificationLog[] {
  const logs = [
    ...recommendations
      .filter(
        (recommendation) =>
          recommendation.status === 'active' &&
          recommendation.deficitInches >= 0.25,
      )
      .slice(0, 4)
      .map((recommendation) =>
        createNotificationLog({
          body: buildWateringBody(recommendation, snapshot),
          garden,
          now,
          type: 'watering',
        }),
      ),
    ...buildWeatherLogs(garden, snapshot, now),
  ];
  const existingKeys = new Set(
    garden.notificationLogs.map(
      (log) => `${log.channel}:${log.type}:${log.messageSummary}`,
    ),
  );

  return logs.filter(
    (log) =>
      !existingKeys.has(`${log.channel}:${log.type}:${log.messageSummary}`),
  );
}

function buildWeatherLogs(
  garden: Garden,
  snapshot: WeatherSnapshot,
  now: Date,
) {
  const logs: NotificationLog[] = [];

  if (snapshot.frostRisk !== 'none') {
    logs.push(
      createNotificationLog({
        body: 'Frost risk tonight. Protect basil, peppers, and tender starts.',
        garden,
        now,
        type: 'frost',
      }),
    );
  }

  if (snapshot.heatRisk !== 'none') {
    logs.push(
      createNotificationLog({
        body: 'Heat stress likely tomorrow afternoon for containers and shallow beds.',
        garden,
        now,
        type: 'heatStress',
      }),
    );
  }

  if (snapshot.alertSummaries.length > 0) {
    logs.push(
      createNotificationLog({
        body:
          snapshot.alertSummaries[0] ?? 'Severe weather alert for your garden.',
        garden,
        now,
        type: 'severeWeather',
      }),
    );
  }

  return logs;
}

function createNotificationLog({
  body,
  garden,
  now,
  type,
}: {
  body: string;
  garden: Garden;
  now: Date;
  type: NotificationLog['type'];
}): NotificationLog {
  return {
    body,
    channel: 'inApp',
    createdAtIso: now.toISOString(),
    dryRun: false,
    errorMessage: null,
    gardenId: garden.id,
    id: `in-app-${type}-${now.getTime()}-${slugify(body).slice(0, 20)}`,
    messageSummary: body,
    provider: 'inApp',
    recipientRedacted: 'in-app',
    sentAtIso: now.toISOString(),
    status: 'sent',
    taskId: null,
    type,
    userId: garden.userId,
  };
}

function buildWateringBody(
  recommendation: WaterRecommendation,
  snapshot: WeatherSnapshot,
) {
  const rainPhrase =
    (snapshot.forecastRainNext24In ?? 0) < 0.1
      ? 'Rain is unlikely today.'
      : `${(snapshot.forecastRainNext24In ?? 0).toFixed(1)} in of rain may arrive today.`;

  return `${recommendation.targetLabel} are short ${recommendation.deficitInches.toFixed(1)} in of water. ${rainPhrase}`;
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}
