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
  fallbackCropWaterNeed,
  getLifecycleAllowedDepletionInches,
  getLifecycleDailyNeedInches,
  getLifecycleEffectiveRainCreditInches,
  getLifecycleHeatMultiplier,
  getLifecycleRootZoneCapacityInches,
  getLifecycleSoilMultiplier,
  getLifecycleDrainageMultiplier,
  getPlantingWaterProfile,
  getTargetLifecycleStage,
  type WaterLifecycleStage,
} from './wateringLifecycle';

const FORECAST_RAIN_CREDIT_CAP = 0.75;

export interface WateringOutlookDefaults {
  timezone?: string | null;
}

type WateringWindowKind =
  | 'coveredByRain'
  | 'dateRange'
  | 'dueNow'
  | 'specificDay';

interface WateringOutlookRun {
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

export interface WateringWindow {
  amountInches: number;
  bestDate: LocalDateString;
  details: string;
  endDate: LocalDateString;
  groupKey: string;
  headline: string;
  id: string;
  kind: WateringWindowKind;
  label: string;
  memberLabels: string[];
  rangeLabel: string;
  startDate: LocalDateString;
  targetCount: number;
  urgency: WateringScheduleUrgency;
}

interface OutlookTarget {
  currentDeficitInches: number;
  drainageProfile: DrainageProfile;
  groupKey: string;
  id: string;
  irrigationZone: string | null;
  isContainer: boolean;
  kind: 'bed' | 'planting';
  label: string;
  lifecycleStage: WaterLifecycleStage;
  memberLabels: string[];
  mulched: boolean;
  priorRun: WateringScheduleEntry | null;
  rootZoneCapacityInches: number;
  soilType: SoilType;
  targetCount: number;
  thresholdInches: number;
  weeklyWaterNeedInches: number;
}

export function buildWateringOutlook(
  garden: Garden,
  snapshot: WeatherSnapshot | null,
  now = new Date(),
  defaults: WateringOutlookDefaults = {},
): WateringWindow[] {
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

  return collapseRunsIntoWindows(runs, todayDate);
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
    const rainCredit = getRainCredit(day.expectedRainIn, target);
    balanceInches = Math.min(
      Math.max(balanceInches + dailyNeedInches - rainCredit, 0),
      target.rootZoneCapacityInches,
    );

    if (balanceInches < getPracticalEventThreshold(target, day.highF)) {
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

function getPracticalEventThreshold(
  target: OutlookTarget,
  dailyHighF: number | null,
) {
  if ((dailyHighF ?? 0) >= 95) {
    return target.thresholdInches;
  }

  const practicalThreshold = target.isContainer
    ? 0.28
    : target.lifecycleStage === 'establishing'
      ? 0.3
      : target.lifecycleStage === 'mixed'
        ? 0.4
        : 0.5;

  return Math.max(target.thresholdInches, practicalThreshold);
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

function collapseRunsIntoWindows(
  runs: WateringOutlookRun[],
  todayDate: LocalDateString,
): WateringWindow[] {
  const runsByGroup = new Map<string, WateringOutlookRun[]>();

  runs.forEach((run) => {
    runsByGroup.set(run.groupKey, [
      ...(runsByGroup.get(run.groupKey) ?? []),
      run,
    ]);
  });

  return [...runsByGroup.values()]
    .flatMap((groupRuns) => buildWindowsForGroup(groupRuns, todayDate))
    .sort(
      (left, right) =>
        left.bestDate.localeCompare(right.bestDate) ||
        urgencyRank(right.urgency) - urgencyRank(left.urgency) ||
        right.amountInches - left.amountInches ||
        left.label.localeCompare(right.label),
    );
}

function buildWindowsForGroup(
  runs: WateringOutlookRun[],
  todayDate: LocalDateString,
) {
  const sortedRuns = [...runs].sort((left, right) =>
    left.date.localeCompare(right.date),
  );

  return sortedRuns.length > 0 ? [createWindow(sortedRuns, todayDate)] : [];
}

function createWindow(
  runs: WateringOutlookRun[],
  todayDate: LocalDateString,
): WateringWindow {
  const startDate = runs[0]?.date ?? todayDate;
  const endDate = runs[runs.length - 1]?.date ?? startDate;
  const bestRun =
    runs.find((run) => run.urgency === 'high') ??
    runs.find((run) => run.urgency === 'medium') ??
    runs[0];
  const bestDate = bestRun?.date ?? startDate;
  const firstRun = runs[0];
  const amountInches = roundTo(
    Math.max(...runs.map((run) => run.expectedAmountInches), 0),
    2,
  );
  const urgency = runs.reduce<WateringScheduleUrgency>(
    (currentUrgency, run) =>
      urgencyRank(run.urgency) > urgencyRank(currentUrgency)
        ? run.urgency
        : currentUrgency,
    'none',
  );
  const kind = getWindowKind(startDate, endDate, todayDate);
  const rangeLabel = formatWateringRange(startDate, endDate);

  return {
    amountInches,
    bestDate,
    details: getWindowDetails(kind, bestDate, firstRun?.reason ?? ''),
    endDate,
    groupKey: firstRun?.groupKey ?? `window:${startDate}`,
    headline: getWindowHeadline(
      firstRun?.label ?? 'Garden',
      kind,
      rangeLabel,
      bestDate,
      todayDate,
    ),
    id: `window:${firstRun?.groupKey ?? 'garden'}:${startDate}:${endDate}`,
    kind,
    label: firstRun?.label ?? 'Garden',
    memberLabels: sortLabels(runs.flatMap((run) => run.memberLabels)),
    rangeLabel,
    startDate,
    targetCount: runs.reduce(
      (total, run) => Math.max(total, run.targetCount),
      0,
    ),
    urgency,
  };
}

function getWindowKind(
  startDate: LocalDateString,
  endDate: LocalDateString,
  todayDate: LocalDateString,
): WateringWindowKind {
  if (startDate <= todayDate) {
    return 'dueNow';
  }

  return startDate === endDate ? 'specificDay' : 'dateRange';
}

function getWindowHeadline(
  label: string,
  kind: WateringWindowKind,
  rangeLabel: string,
  bestDate: LocalDateString,
  todayDate: LocalDateString,
) {
  if (kind === 'dueNow') {
    return `Water ${label} today`;
  }

  if (kind === 'specificDay') {
    return `Water ${label} ${formatFriendlyDate(bestDate, todayDate)}`;
  }

  return `Water ${label} ${rangeLabel}`;
}

function getWindowDetails(
  kind: WateringWindowKind,
  bestDate: LocalDateString,
  reason: string,
) {
  const bestDateCopy =
    kind === 'dueNow'
      ? 'Best: today.'
      : `Best: ${formatMonthDay(bestDate)} morning.`;
  const practicalCopy =
    kind === 'dateRange'
      ? 'A deeper soak in this window is better than small daily watering.'
      : 'A deeper soak is better than a small daily watering.';

  return reason
    ? `${bestDateCopy} ${practicalCopy} ${reason}`
    : `${bestDateCopy} ${practicalCopy}`;
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
      const lifecycleStage = getTargetLifecycleStage(plantings, now);
      const weeklyWaterNeedInches = getBedWeeklyNeedInches(
        plantings,
        structure,
        now,
      );
      const targetContext = {
        drainageProfile: structure.drainageProfile ?? 'unknown',
        isContainer: structure.type === 'container',
        lifecycleStage,
        mulched: structure.mulched,
        plantings,
        soilType: structure.soilType ?? 'unknown',
        weeklyWaterNeedInches,
      };

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
          isContainer: targetContext.isContainer,
          kind: 'bed',
          label: structure.label,
          lifecycleStage,
          memberLabels: sortLabels(plantings.map((planting) => planting.label)),
          mulched: structure.mulched,
          priorRun: wateringEntriesByTargetId.get(structure.id) ?? null,
          rootZoneCapacityInches:
            getLifecycleRootZoneCapacityInches(targetContext),
          soilType: structure.soilType ?? 'unknown',
          targetCount: plantings.length,
          thresholdInches: getLifecycleAllowedDepletionInches(
            targetContext,
            snapshot.temperatureF,
          ),
          weeklyWaterNeedInches,
        },
      ];
    }),
    ...standalonePlantings.map(({ planting, structure }): OutlookTarget => {
      const groupKey =
        (planting.irrigationZone ?? structure?.irrigationZone)
          ? `zone:${planting.irrigationZone ?? structure?.irrigationZone}`
          : `planting:${planting.id}`;
      const lifecycleStage = getTargetLifecycleStage([planting], now);
      const weeklyWaterNeedInches = getPlantingWeeklyNeedInches(
        planting,
        structure,
        now,
      );
      const targetContext = {
        drainageProfile: structure?.drainageProfile ?? 'unknown',
        isContainer: structure?.type === 'container',
        lifecycleStage,
        mulched: planting.mulched,
        plantings: [planting],
        soilType: structure?.soilType ?? 'unknown',
        weeklyWaterNeedInches,
      };

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
        isContainer: targetContext.isContainer,
        kind: 'planting',
        label: planting.label,
        lifecycleStage,
        memberLabels: sortLabels([planting.label]),
        mulched: planting.mulched,
        priorRun: wateringEntriesByTargetId.get(planting.id) ?? null,
        rootZoneCapacityInches:
          getLifecycleRootZoneCapacityInches(targetContext),
        soilType: structure?.soilType ?? 'unknown',
        targetCount: Math.max(getPlantingInstances(planting).length, 1),
        thresholdInches: getLifecycleAllowedDepletionInches(
          targetContext,
          snapshot.temperatureF,
        ),
        weeklyWaterNeedInches,
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
    if (existingEntry.waterBalance) {
      return existingEntry.waterBalance.effectiveDeficitInches;
    }

    if (existingEntry.status === 'suppressed') {
      return Math.max(
        existingEntry.deficitInches -
          getRainCredit(snapshot.forecastRainNext24In ?? 0, {
            isContainer: structure?.type === 'container',
          }),
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
    (weeklyNeed / 7) * 3 * getLifecycleHeatMultiplier(snapshot.temperatureF) +
    Math.min(snapshot.evapotranspirationIn ?? 0, 0.2);
  const remainingBeforeForecast = Math.max(
    adjustedNeed -
      (snapshot.recentPrecipitation72hIn ?? 0) * 0.8 -
      manualWaterIn,
    0,
  );

  return Math.max(
    remainingBeforeForecast -
      getRainCredit(snapshot.forecastRainNext24In ?? 0, {
        isContainer: structure?.type === 'container',
      }),
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

  if (currentEntry.waterBalance) {
    return (
      currentEntry.waterBalance.currentDepletionInches ??
      currentEntry.waterBalance.effectiveDeficitInches
    );
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
  return getLifecycleDailyNeedInches(target, {
    dailyHighF: highF,
  });
}

function getBedWeeklyNeedInches(
  plantings: Garden['plantings'],
  structure: Structure | undefined,
  now: Date,
) {
  const plantWaterProfiles = plantings.map((planting) =>
    getPlantingWaterProfile(planting, now, fallbackCropWaterNeed),
  );
  const highestCropNeed = Math.max(
    ...plantWaterProfiles.map((profile) => profile.weeklyWaterNeedInches),
    0,
  );
  const bedMultiplier =
    structure?.type === 'container'
      ? 1.25
      : structure?.type === 'raisedBed' || structure?.type === 'bed'
        ? 1.1
        : 1;
  const mulchedMultiplier = structure?.mulched ? 0.85 : 1;
  const soilMultiplier = getLifecycleSoilMultiplier(
    structure?.soilType ?? 'unknown',
  );
  const drainageMultiplier = getLifecycleDrainageMultiplier(
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
    highestCropNeed *
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
    getLifecycleSoilMultiplier(structure?.soilType ?? 'unknown') *
    getLifecycleDrainageMultiplier(structure?.drainageProfile ?? 'unknown')
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

function getRainCredit(
  expectedRainIn: number,
  target: Pick<OutlookTarget, 'isContainer'>,
) {
  return getLifecycleEffectiveRainCreditInches(
    expectedRainIn,
    target,
    FORECAST_RAIN_CREDIT_CAP,
  );
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

function formatWateringRange(
  startDate: LocalDateString,
  endDate: LocalDateString,
) {
  return startDate === endDate
    ? formatMonthDay(startDate)
    : `${formatMonthDay(startDate)}-${formatMonthDay(endDate)}`;
}

function formatFriendlyDate(date: LocalDateString, todayDate: LocalDateString) {
  if (date === todayDate) {
    return 'today';
  }

  if (date === addDays(todayDate, 1)) {
    return 'tomorrow';
  }

  return formatMonthDay(date);
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
