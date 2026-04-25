import type {
  Garden,
  NotificationLog,
  WateringScheduleEntry,
  WeatherSnapshot,
} from '../../domain/gardens/GardenRepository';

export function buildInAppNotificationLogs(
  garden: Garden,
  recommendations: WateringScheduleEntry[],
  snapshot: WeatherSnapshot,
  now = new Date(),
): NotificationLog[] {
  const logs = [
    ...recommendations
      .filter(
        (recommendation) =>
          recommendation.status === 'due' &&
          recommendation.targetAmountInches >= 0.25 &&
          !hasRecentWateringAction(garden, recommendation, now),
      )
      .slice(0, 4)
      .map((recommendation) =>
        createNotificationLog({
          body: buildWateringBody(recommendation, snapshot),
          dedupeKey: buildWateringDedupeKey(recommendation),
          garden,
          messageSummary: `Water ${recommendation.targetLabel} today`,
          now,
          taskId: getWaterTaskId(garden, recommendation),
          type: 'watering',
        }),
      ),
    ...buildWeatherLogs(garden, snapshot, now),
  ];

  return logs.filter(
    (log) => !isSuppressedByNotificationHistory(garden, log, now),
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
        body: 'Cover basil, peppers, and tender starts tonight; frost is possible.',
        dedupeKey: `weather:frost:${snapshot.observedForDate}`,
        garden,
        messageSummary: 'Frost cover check tonight',
        now,
        type: 'frost',
      }),
    );
  }

  if (snapshot.heatRisk !== 'none') {
    logs.push(
      createNotificationLog({
        body: 'Check water early for containers and shallow beds; heat stress is likely tomorrow afternoon.',
        dedupeKey: `weather:heat:${snapshot.observedForDate}`,
        garden,
        messageSummary: 'Heat water check',
        now,
        type: 'heatStress',
      }),
    );
  }

  if (snapshot.alertSummaries.length > 0) {
    logs.push(
      createNotificationLog({
        body:
          snapshot.alertSummaries[0] ??
          'Check covers and supports; severe weather may affect the garden.',
        dedupeKey: `weather:severe:${snapshot.observedForDate}`,
        garden,
        messageSummary: 'Severe weather garden check',
        now,
        type: 'severeWeather',
      }),
    );
  }

  return logs;
}

function createNotificationLog({
  body,
  dedupeKey,
  garden,
  messageSummary,
  now,
  taskId = null,
  type,
}: {
  body: string;
  dedupeKey: string;
  garden: Garden;
  messageSummary: string;
  now: Date;
  taskId?: string | null;
  type: NotificationLog['type'];
}): NotificationLog {
  return {
    acknowledgedAtIso: null,
    body,
    channel: 'inApp',
    createdAtIso: now.toISOString(),
    decisionReason: 'client in-app log',
    dedupeKey,
    deepLink: '/app/today',
    dismissedAtIso: null,
    dryRun: false,
    errorMessage: null,
    gardenId: garden.id,
    id: `in-app-${type}-${now.getTime()}-${slugify(body).slice(0, 20)}`,
    messageSummary,
    provider: 'inApp',
    recipientRedacted: 'in-app',
    sentAtIso: now.toISOString(),
    snoozedUntilIso: null,
    status: 'sent',
    taskId,
    type,
    userId: garden.userId,
  };
}

function buildWateringBody(
  recommendation: WateringScheduleEntry,
  snapshot: WeatherSnapshot,
) {
  const rainPhrase =
    (snapshot.forecastRainNext24In ?? 0) < 0.1
      ? 'Rain is unlikely today.'
      : `${(snapshot.forecastRainNext24In ?? 0).toFixed(1)} in of rain may arrive today.`;

  const amount =
    recommendation.targetAmountInches >= 0.75
      ? recommendation.targetAmountInches.toFixed(1)
      : recommendation.targetAmountInches.toFixed(2);

  return `Water ${recommendation.targetLabel} ${amount} in today. ${rainPhrase}`;
}

function buildWateringDedupeKey(recommendation: WateringScheduleEntry) {
  return [
    'watering',
    recommendation.targetKind,
    recommendation.targetId,
    recommendation.dueDate,
  ].join(':');
}

function getWaterTaskId(garden: Garden, recommendation: WateringScheduleEntry) {
  return (
    garden.tasks.find(
      (task) =>
        task.type === 'water' &&
        task.source === 'wateringSchedule' &&
        task.sourceId === recommendation.id,
    )?.id ?? null
  );
}

function hasRecentWateringAction(
  garden: Garden,
  recommendation: WateringScheduleEntry,
  now: Date,
) {
  const targetDate = recommendation.dueDate || now.toISOString().slice(0, 10);
  const completedWaterTask = garden.tasks.some(
    (task) =>
      task.type === 'water' &&
      task.sourceId === recommendation.id &&
      task.status === 'done' &&
      (task.completedAtIso ?? '').slice(0, 10) === targetDate,
  );

  if (completedWaterTask) {
    return true;
  }

  const targetLabel = recommendation.targetLabel.toLowerCase();

  return garden.journalEntries.some((entry) => {
    const text = `${entry.title} ${entry.body}`.toLowerCase();
    const matchesTarget =
      entry.plantingId ===
        (recommendation.targetKind === 'planting'
          ? recommendation.targetId
          : null) ||
      entry.structureId === recommendation.targetId ||
      entry.targetLabel === recommendation.targetLabel ||
      text.includes(targetLabel);

    return (
      entry.occurredOn === targetDate && matchesTarget && text.includes('water')
    );
  });
}

function isSuppressedByNotificationHistory(
  garden: Garden,
  candidate: NotificationLog,
  now: Date,
) {
  const cutoffMs = now.getTime() - 24 * 60 * 60 * 1000;

  return garden.notificationLogs.some((log) => {
    const createdAtMs = Date.parse(log.createdAtIso);
    const snoozedUntilMs = Date.parse(log.snoozedUntilIso ?? '');
    const matchesDedupe =
      Boolean(candidate.dedupeKey && log.dedupeKey === candidate.dedupeKey) ||
      `${log.channel}:${log.type}:${log.messageSummary}` ===
        `${candidate.channel}:${candidate.type}:${candidate.messageSummary}`;

    if (!matchesDedupe) {
      return false;
    }

    if (Number.isFinite(snoozedUntilMs) && snoozedUntilMs > now.getTime()) {
      return true;
    }

    return Number.isFinite(createdAtMs) && createdAtMs >= cutoffMs;
  });
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}
