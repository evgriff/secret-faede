import type {
  DrainageProfile,
  Garden,
  LocalDateString,
  SoilType,
  Structure,
  WateringScheduleEntry,
  WateringScheduleUrgency,
  WeatherSnapshot,
} from '../../domain/gardens/GardenRepository';
import { getPlantingInstances } from '../../domain/gardens/GardenRepository';
import { getStructureFootprint } from './gardenPlanning';
import {
  ACTIVE_WATERING_STATUSES,
  getPlantingWaterProfile,
  getTargetLifecycleStage,
} from './wateringLifecycle';

const MIN_ACTIONABLE_DEFICIT_INCHES = 0.15;
const FORECAST_RAIN_CREDIT_CAP = 0.75;

export interface WateringOutlookDefaults {
  timezone?: string | null;
}

export interface WateringOutlookRun {
  date: LocalDateString;
  expectedAmountInches: number;
  groupKey: string;
  id: string;
  isSuppressedUntilDate: LocalDateString | null;
  kind: 'watering';
  label: string;
  memberLabels: string[];
  reason: string;
  summary: string;
  targetCount: number;
  urgency: WateringScheduleUrgency;
}

interface OutlookTarget {
  currentDeficitInches: number;
  drainageProfile: DrainageProfile;
  groupKey: string;
  id: string;
  irrigationZone: string | null;
  kind: 'bed' | 'planting';
  label: string;
  memberLabels: string[];
  mulched: boolean;
  priorRun: WateringScheduleEntry | null;
  soilType: SoilType;
  targetCount: number;
  weeklyWaterNeedInches: number;
}

export function buildWateringOutlook(
  garden: Garden,
  snapshot: WeatherSnapshot | null,
  now = new Date(),
  defaults: WateringOutlookDefaults = {},
): WateringOutlookRun[] {
  if (!snapshot) {
    return [];
  }

  const timezone = defaults.timezone || garden.plot.location.timezone;
  const todayDate = formatLocalDate(now, timezone);
  const forecastDays = getForecastDays(snapshot, todayDate);

  if (forecastDays.length === 0) {
    return [];
  }

  const targets = getOutlookTargets(garden, snapshot, now);
  const runs = aggregateRunsByGroupDate(
    targets.flatMap((target) =>
      buildTargetOutlookRuns(target, forecastDays, todayDate),
    ),
  );

  return runs.sort(
    (left, right) =>
      left.date.localeCompare(right.date) ||
      urgencyRank(right.urgency) - urgencyRank(left.urgency) ||
      right.expectedAmountInches - left.expectedAmountInches ||
      left.label.localeCompare(right.label),
  );
}

function buildTargetOutlookRuns(
  target: OutlookTarget,
  forecastDays: NonNullable<WeatherSnapshot['forecastDays']>,
  todayDate: LocalDateString,
): WateringOutlookRun[] {
  const currentEntry = target.priorRun;
  const runs: WateringOutlookRun[] = [];
  let balanceInches = getStartingBalance(target, currentEntry);
  let startIndex = 1;

  if (
    currentEntry &&
    ['scheduled', 'snoozed'].includes(currentEntry.status) &&
    currentEntry.dueDate >= todayDate
  ) {
    runs.push(
      createRun(target, currentEntry.dueDate, currentEntry.targetAmountInches, {
        isSuppressedUntilDate: null,
        reason:
          currentEntry.reasonSummary ||
          `${currentEntry.targetLabel} is scheduled for the next watering check.`,
        summary:
          currentEntry.dueDate === todayDate
            ? `Next watering likely later today for ${currentEntry.targetLabel}.`
            : `Next watering likely ${formatMonthDay(currentEntry.dueDate)} for ${currentEntry.targetLabel}.`,
        urgency: currentEntry.urgency,
      }),
    );
    balanceInches = 0;
    startIndex =
      forecastDays.findIndex((day) => day.date === currentEntry.dueDate) + 1;
  }

  if (
    currentEntry?.status === 'suppressed' &&
    currentEntry.nextRecalculationAtIso &&
    balanceInches > 0
  ) {
    const suppressedUntilDate = toLocalDateFromIso(
      currentEntry.nextRecalculationAtIso,
    );
    const firstForecastDate = forecastDays[1]?.date ?? todayDate;
    const startDate =
      suppressedUntilDate && suppressedUntilDate > firstForecastDate
        ? suppressedUntilDate
        : firstForecastDate;

    startIndex = Math.max(
      startIndex,
      forecastDays.findIndex((day) => day.date >= startDate),
    );
  }

  for (
    let index = Math.max(startIndex, 0);
    index < forecastDays.length;
    index += 1
  ) {
    const day = forecastDays[index];

    if (!day) {
      continue;
    }

    const dailyNeedInches = getDailyNeedInches(target, day.highF);
    const rainCredit = getRainCredit(day.expectedRainIn);
    balanceInches = Math.max(balanceInches + dailyNeedInches - rainCredit, 0);

    if (balanceInches < MIN_ACTIONABLE_DEFICIT_INCHES) {
      continue;
    }

    const amount = roundTo(balanceInches, 2);
    runs.push(
      createRun(target, day.date, amount, {
        isSuppressedUntilDate: null,
        reason:
          rainCredit > 0
            ? `${target.label} will likely need water after ${roundTo(
                rainCredit,
                2,
              )} in of forecast rain on ${formatMonthDay(day.date)}.`
            : `${target.label} will likely need water around ${formatMonthDay(
                day.date,
              )} if weather stays on this track.`,
        summary: `Next watering likely ${formatMonthDay(day.date)} for ${target.label}.`,
        urgency: getUrgency(amount, day.highF),
      }),
    );
    balanceInches = 0;
  }

  return dedupeRunsByDate(runs);
}

function createRun(
  target: OutlookTarget,
  date: LocalDateString,
  expectedAmountInches: number,
  details: {
    isSuppressedUntilDate: LocalDateString | null;
    reason: string;
    summary: string;
    urgency: WateringScheduleUrgency;
  },
): WateringOutlookRun {
  return {
    date,
    expectedAmountInches: roundTo(expectedAmountInches, 2),
    groupKey: target.groupKey,
    id: `outlook:${target.groupKey}:${date}`,
    isSuppressedUntilDate: details.isSuppressedUntilDate,
    kind: 'watering',
    label: target.label,
    memberLabels: target.memberLabels,
    reason: details.reason,
    summary: details.summary,
    targetCount: target.targetCount,
    urgency: details.urgency,
  };
}

function dedupeRunsByDate(runs: WateringOutlookRun[]) {
  const runByDate = new Map<LocalDateString, WateringOutlookRun>();

  runs.forEach((run) => {
    const existing = runByDate.get(run.date);

    if (
      !existing ||
      urgencyRank(run.urgency) > urgencyRank(existing.urgency) ||
      run.expectedAmountInches > existing.expectedAmountInches
    ) {
      runByDate.set(run.date, run);
    }
  });

  return [...runByDate.values()];
}

function aggregateRunsByGroupDate(runs: WateringOutlookRun[]) {
  const aggregatedRuns = new Map<string, WateringOutlookRun>();

  runs.forEach((run) => {
    const key = `${run.groupKey}:${run.date}`;
    const existing = aggregatedRuns.get(key);

    if (!existing) {
      aggregatedRuns.set(key, run);
      return;
    }

    aggregatedRuns.set(key, {
      ...existing,
      expectedAmountInches: roundTo(
        existing.expectedAmountInches + run.expectedAmountInches,
        2,
      ),
      id: `outlook:${existing.groupKey}:${existing.date}`,
      isSuppressedUntilDate:
        existing.isSuppressedUntilDate ?? run.isSuppressedUntilDate,
      memberLabels: sortLabels([...existing.memberLabels, ...run.memberLabels]),
      reason:
        existing.reason === run.reason
          ? existing.reason
          : `${existing.reason} ${run.reason}`,
      summary: existing.summary,
      targetCount: existing.targetCount + run.targetCount,
      urgency:
        urgencyRank(run.urgency) > urgencyRank(existing.urgency)
          ? run.urgency
          : existing.urgency,
    });
  });

  return [...aggregatedRuns.values()];
}

function getOutlookTargets(
  garden: Garden,
  snapshot: WeatherSnapshot,
  now: Date,
) {
  const groupedPlantings = new Map<string, Garden['plantings']>();
  const standalonePlantings: Array<{
    planting: Garden['plantings'][number];
    structure: Structure | undefined;
  }> = [];
  const wateringEntriesByTargetId = new Map(
    garden.wateringSchedule.map((entry) => [entry.targetId, entry]),
  );

  garden.plantings
    .filter((planting) => ACTIVE_WATERING_STATUSES.has(planting.status))
    .forEach((planting) => {
      const structure = getPlantingStructure(garden, planting);

      if (structure && isWaterableStructure(structure)) {
        groupedPlantings.set(structure.id, [
          ...(groupedPlantings.get(structure.id) ?? []),
          planting,
        ]);
        return;
      }

      standalonePlantings.push({ planting, structure });
    });

  return [
    ...garden.structures.flatMap((structure): OutlookTarget[] => {
      if (!isWaterableStructure(structure)) {
        return [];
      }

      const plantings = groupedPlantings.get(structure.id) ?? [];

      if (plantings.length === 0) {
        return [];
      }

      const groupKey = structure.irrigationZone
        ? `zone:${structure.irrigationZone}`
        : `bed:${structure.id}`;

      return [
        {
          currentDeficitInches: getCurrentDeficitInches(
            structure.id,
            'bed',
            wateringEntriesByTargetId.get(structure.id) ?? null,
            plantings,
            structure,
            garden.journalEntries,
            snapshot,
            now,
          ),
          drainageProfile: structure.drainageProfile ?? 'unknown',
          groupKey,
          id: structure.id,
          irrigationZone: structure.irrigationZone ?? null,
          kind: 'bed',
          label: structure.label,
          memberLabels: sortLabels(plantings.map((planting) => planting.label)),
          mulched: structure.mulched,
          priorRun: wateringEntriesByTargetId.get(structure.id) ?? null,
          soilType: structure.soilType ?? 'unknown',
          targetCount: plantings.length,
          weeklyWaterNeedInches: getBedWeeklyNeedInches(
            plantings,
            structure,
            now,
          ),
        },
      ];
    }),
    ...standalonePlantings.map(({ planting, structure }): OutlookTarget => {
      const groupKey =
        (planting.irrigationZone ?? structure?.irrigationZone)
          ? `zone:${planting.irrigationZone ?? structure?.irrigationZone}`
          : `planting:${planting.id}`;

      return {
        currentDeficitInches: getCurrentDeficitInches(
          planting.id,
          'planting',
          wateringEntriesByTargetId.get(planting.id) ?? null,
          [planting],
          structure,
          garden.journalEntries,
          snapshot,
          now,
        ),
        drainageProfile: structure?.drainageProfile ?? 'unknown',
        groupKey,
        id: planting.id,
        irrigationZone:
          planting.irrigationZone ?? structure?.irrigationZone ?? null,
        kind: 'planting',
        label: planting.label,
        memberLabels: sortLabels([planting.label]),
        mulched: planting.mulched,
        priorRun: wateringEntriesByTargetId.get(planting.id) ?? null,
        soilType: structure?.soilType ?? 'unknown',
        targetCount: Math.max(getPlantingInstances(planting).length, 1),
        weeklyWaterNeedInches: getPlantingWeeklyNeedInches(
          planting,
          structure,
          now,
        ),
      };
    }),
  ];
}

function getCurrentDeficitInches(
  targetId: string,
  targetKind: 'bed' | 'planting',
  existingEntry: WateringScheduleEntry | null,
  plantings: Garden['plantings'],
  structure: Structure | undefined,
  journalEntries: Garden['journalEntries'],
  snapshot: WeatherSnapshot,
  now: Date,
) {
  const primaryPlanting = plantings[0];

  if (!primaryPlanting) {
    return 0;
  }

  if (existingEntry) {
    if (existingEntry.status === 'suppressed') {
      return Math.max(
        existingEntry.deficitInches -
          getRainCredit(snapshot.forecastRainNext24In ?? 0),
        0,
      );
    }

    if (
      existingEntry.status === 'scheduled' ||
      existingEntry.status === 'due' ||
      existingEntry.status === 'partial' ||
      existingEntry.status === 'snoozed'
    ) {
      return 0;
    }

    return 0;
  }

  const weeklyNeed =
    targetKind === 'bed'
      ? getBedWeeklyNeedInches(plantings, structure, now)
      : getPlantingWeeklyNeedInches(primaryPlanting, structure, now);
  const targetLabel =
    targetKind === 'bed'
      ? (structure?.label ?? primaryPlanting.label)
      : primaryPlanting.label;
  const manualWaterIn = estimateManualWatering(
    targetId,
    targetKind,
    plantings,
    structure,
    now,
    targetLabel,
    journalEntries,
  );
  const adjustedNeed =
    weeklyNeed + Math.min(snapshot.evapotranspirationIn ?? 0, 0.35);
  const remainingBeforeForecast = Math.max(
    adjustedNeed - (snapshot.recentPrecipitation72hIn ?? 0) - manualWaterIn,
    0,
  );

  return Math.max(
    remainingBeforeForecast - getRainCredit(snapshot.forecastRainNext24In ?? 0),
    0,
  );
}

function getStartingBalance(
  target: OutlookTarget,
  currentEntry: WateringScheduleEntry | null,
) {
  if (!currentEntry) {
    return target.currentDeficitInches;
  }

  if (currentEntry.status === 'suppressed') {
    return target.currentDeficitInches;
  }

  if (
    currentEntry.status === 'scheduled' ||
    currentEntry.status === 'snoozed' ||
    currentEntry.status === 'due' ||
    currentEntry.status === 'partial'
  ) {
    return 0;
  }

  return target.currentDeficitInches;
}

function getDailyNeedInches(target: OutlookTarget, highF: number | null) {
  return (target.weeklyWaterNeedInches * getHeatMultiplier(highF)) / 7;
}

function getBedWeeklyNeedInches(
  plantings: Garden['plantings'],
  structure: Structure | undefined,
  now: Date,
) {
  const plantWaterProfiles = plantings.map((planting) =>
    getPlantingWaterProfile(planting, now, fallbackCropWaterNeed),
  );
  const averageCropNeed =
    plantWaterProfiles.reduce(
      (total, profile) => total + profile.weeklyWaterNeedInches,
      0,
    ) / Math.max(plantWaterProfiles.length, 1);
  const bedMultiplier =
    structure?.type === 'container'
      ? 1.25
      : structure?.type === 'raisedBed' || structure?.type === 'bed'
        ? 1.1
        : 1;
  const mulchedMultiplier = structure?.mulched ? 0.85 : 1;
  const soilMultiplier = getSoilMultiplier(structure?.soilType ?? 'unknown');
  const drainageMultiplier = getDrainageMultiplier(
    structure?.drainageProfile ?? 'unknown',
  );
  const lifecycleStage = getTargetLifecycleStage(plantings, now);
  const lifecycleMultiplier =
    lifecycleStage === 'establishing'
      ? 1.05
      : lifecycleStage === 'mixed'
        ? 1.02
        : 1;

  return (
    averageCropNeed *
    bedMultiplier *
    mulchedMultiplier *
    soilMultiplier *
    drainageMultiplier *
    lifecycleMultiplier
  );
}

function getPlantingWeeklyNeedInches(
  planting: Garden['plantings'][number],
  structure: Structure | undefined,
  now: Date,
) {
  const waterProfile = getPlantingWaterProfile(
    planting,
    now,
    fallbackCropWaterNeed,
  );
  const containerMultiplier =
    structure?.type === 'container'
      ? 1.25
      : structure?.type === 'raisedBed' || structure?.type === 'bed'
        ? 1.05
        : 1;

  return (
    waterProfile.weeklyWaterNeedInches *
    containerMultiplier *
    (planting.mulched ? 0.85 : 1) *
    getSoilMultiplier(structure?.soilType ?? 'unknown') *
    getDrainageMultiplier(structure?.drainageProfile ?? 'unknown')
  );
}

function getPlantingStructure(
  garden: Garden,
  planting: Garden['plantings'][number],
) {
  return garden.structures.find(
    (structure) =>
      isWaterableStructure(structure) &&
      isPointInsideStructure(planting.xFt, planting.yFt, structure),
  );
}

function isWaterableStructure(structure: Structure) {
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

function getForecastDays(
  snapshot: WeatherSnapshot,
  todayDate: LocalDateString,
) {
  if (snapshot.forecastDays && snapshot.forecastDays.length > 0) {
    return snapshot.forecastDays
      .filter((day) => day.date >= todayDate)
      .slice(0, 14);
  }

  return [
    {
      conditionSummary: snapshot.conditionSummary,
      date: todayDate,
      expectedRainIn: snapshot.forecastRainNext24In ?? 0,
      highF: snapshot.temperatureF,
    },
    {
      conditionSummary: snapshot.conditionSummary,
      date: addDays(todayDate, 1),
      expectedRainIn: Math.max(
        (snapshot.forecastRainNext48In ?? snapshot.forecastRainNext24In ?? 0) -
          (snapshot.forecastRainNext24In ?? 0),
        0,
      ),
      highF: snapshot.temperatureF,
    },
  ];
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

function getRainCredit(expectedRainIn: number) {
  return Math.min(expectedRainIn * 0.6, FORECAST_RAIN_CREDIT_CAP);
}

function getUrgency(
  deficitInches: number,
  dailyHighF: number | null,
): WateringScheduleUrgency {
  if (deficitInches >= 0.75 || (dailyHighF ?? 0) >= 95) {
    return 'high';
  }

  if (deficitInches >= 0.4) {
    return 'medium';
  }

  return deficitInches >= 0.15 ? 'low' : 'none';
}

function urgencyRank(urgency: WateringScheduleUrgency) {
  switch (urgency) {
    case 'high':
      return 3;
    case 'medium':
      return 2;
    default:
      return 1;
  }
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

function estimateManualWatering(
  targetId: string,
  targetKind: 'bed' | 'planting',
  plantings: Garden['plantings'],
  structure: Structure | undefined,
  now: Date,
  targetLabel: string,
  journalEntries: Garden['journalEntries'],
) {
  const targetText = targetLabel.toLowerCase();
  const structureId = structure?.id ?? null;
  const start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  return journalEntries.reduce((appliedAmountInches, entry) => {
    const entryIso = entry.createdAtIso || `${entry.occurredOn}T12:00:00.000Z`;
    const entryDate = new Date(entryIso);
    const text = `${entry.title} ${entry.body}`.toLowerCase();
    const directMatch =
      targetKind === 'planting'
        ? entry.plantingId === targetId
        : entry.structureId === targetId ||
          (structureId !== null && entry.structureId === structureId);
    const labelMatch =
      entry.targetLabel.toLowerCase() === targetText ||
      text.includes(targetText);
    const plantingMatch = plantings.some(
      (planting) => entry.plantingId === planting.id,
    );

    if (
      Number.isNaN(entryDate.getTime()) ||
      entryDate < start ||
      !text.includes('water') ||
      (!directMatch && !labelMatch && !plantingMatch)
    ) {
      return appliedAmountInches;
    }

    return appliedAmountInches + readWaterAmountInches(text);
  }, 0);
}

function readWaterAmountInches(text: string) {
  const match = /\b(\d+(?:\.\d+)?)\s*(?:in|inch|inches)\b/i.exec(text);

  return match?.[1] ? Number(match[1]) : 0.25;
}

function addDays(date: LocalDateString, days: number) {
  const parsedDate = new Date(`${date}T12:00:00.000Z`);
  parsedDate.setUTCDate(parsedDate.getUTCDate() + days);
  return parsedDate.toISOString().slice(0, 10);
}

function formatMonthDay(date: LocalDateString) {
  return new Date(`${date}T12:00:00.000Z`).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
  });
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

function roundTo(value: number, precision: number) {
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
}

function sortLabels(labels: string[]) {
  return [...new Set(labels)].sort((left, right) => left.localeCompare(right));
}

function toLocalDateFromIso(value: string) {
  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toISOString().slice(0, 10);
}
