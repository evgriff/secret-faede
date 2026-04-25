import { getCropById } from '../../domain/crops/cropCatalog';
import {
  createDefaultPlanting,
  createPlantingEventJournalEntry,
  getInGroundDate,
  getLatestPlantingEventDate,
} from '../../domain/gardens/GardenRepository';
import { withPlantingInstances } from '../../domain/gardens/plantingInstances';
import type {
  CropProfile,
  Garden,
  LocalDateString,
  Planting,
  Structure,
  SunExposure,
  Task,
  TaskPriority,
  TaskType,
  WateringScheduleEntry,
  WeatherSnapshot,
} from '../../domain/gardens/GardenRepository';
import {
  getPlantingEventTypeForCompletedTask,
  updatePlantingFromCompletedTask,
} from './taskPlantingMutations';
import { getPlantingHarvestSchedule } from '../garden/harvestSchedule';

const dayMs = 24 * 60 * 60 * 1000;

interface TaskInput {
  bedLabel: string | null;
  dueDate: LocalDateString;
  id: string;
  notes: string;
  plantingId: string | null;
  priority?: TaskPriority;
  source: Task['source'];
  sourceId: string | null;
  structureId?: string | null;
  title: string;
  type: TaskType;
}

interface SynchronizeOptions {
  now?: Date;
  refreshOpenGenerated?: boolean;
}

export interface SuccessionRecommendation {
  bedOpensOn: LocalDateString;
  cropId: string;
  cropName: string;
  daysRemaining: number;
  earliestDate: LocalDateString;
  id: string;
  plantingId: string;
  reason: string;
  sunExposure: SunExposure | null;
  targetLabel: string;
}

export interface ManualTaskInput {
  dueDate: LocalDateString;
  notes: string;
  priority?: TaskPriority;
  title: string;
  type: TaskType;
}

export function synchronizeGardenTasks(
  garden: Garden,
  options: SynchronizeOptions = {},
): Garden {
  const now = options.now ?? new Date();
  const generatedTasks = buildGeneratedTasks(garden, now);
  const generatedById = new Map(
    generatedTasks.map((task) => [task.id, task] as const),
  );
  const generatedByKey = new Map(
    generatedTasks.flatMap((task) => {
      const key = getGeneratedTaskKey(task);
      return key ? [[key, task] as const] : [];
    }),
  );
  const existingIds = new Set(garden.tasks.map((task) => task.id));
  const existingGeneratedKeys = new Set(
    garden.tasks.flatMap((task) => {
      const key = getGeneratedTaskKey(task);
      return key ? [key] : [];
    }),
  );
  const retiredAtIso = now.toISOString();
  const mergedExisting = garden.tasks.map((task) => {
    const generated =
      generatedById.get(task.id) ??
      generatedByKey.get(getGeneratedTaskKey(task) ?? '');

    if (shouldRetireStaleGeneratedTask(task, generated)) {
      return {
        ...task,
        completedAtIso: task.completedAtIso ?? retiredAtIso,
        status: 'skipped' as const,
      };
    }

    if (!generated || !shouldRefreshTask(task, options)) {
      return task;
    }

    return {
      ...generated,
      completedAtIso: task.completedAtIso,
      createdAtIso: task.createdAtIso,
      id: task.id,
      status: task.status,
    };
  });
  const missingTasks = generatedTasks.filter(
    (task) =>
      !existingIds.has(task.id) &&
      !existingGeneratedKeys.has(getGeneratedTaskKey(task) ?? ''),
  );

  return {
    ...garden,
    tasks: sortTasks([...mergedExisting, ...missingTasks]),
  };
}

export function buildGeneratedTasks(garden: Garden, now = new Date()): Task[] {
  const tasks = garden.plantings.flatMap((planting) =>
    buildPlantingTasks(garden, planting, now),
  );
  const waterTasks = garden.wateringSchedule.flatMap((entry) =>
    buildWaterTask(garden, entry, now),
  );
  const weatherTasks = buildWeatherTasks(garden, now);

  return sortTasks([...tasks, ...waterTasks, ...weatherTasks]).map((task) => ({
    ...task,
    gardenId: garden.id,
  }));
}

export function completeTask(
  garden: Garden,
  taskId: string,
  completedAt = new Date(),
): Garden {
  const task = garden.tasks.find((candidate) => candidate.id === taskId);

  if (!task) {
    return garden;
  }

  const completedAtIso = completedAt.toISOString();
  const completedDate = task.dueDate ?? toLocalDate(completedAt);
  const updatedTasks = garden.tasks.map((candidate) => {
    if (candidate.id === taskId) {
      return {
        ...candidate,
        completedAtIso,
        status: 'done' as const,
      };
    }

    if (shouldClearSetupTask(candidate, task, completedDate)) {
      return {
        ...candidate,
        completedAtIso,
        status: 'skipped' as const,
      };
    }

    return candidate;
  });
  const eventfulPlanting = garden.plantings.find(
    (candidate) => candidate.id === task.plantingId,
  );
  const eventType = getPlantingEventTypeForCompletedTask(task);
  const plantings = garden.plantings.map((planting) =>
    updatePlantingFromCompletedTask(
      planting,
      task,
      completedDate,
      completedAtIso,
      eventType,
    ),
  );
  const wateringSchedule =
    task.type === 'water' && task.sourceId
      ? garden.wateringSchedule.map((entry) =>
          entry.id === task.sourceId
            ? {
                ...entry,
                appliedAmountInches:
                  (entry.appliedAmountInches ?? 0) + entry.targetAmountInches,
                lastWateredAtIso: completedAtIso,
                status: 'completed' as const,
                updatedAtIso: completedAtIso,
              }
            : entry,
        )
      : garden.wateringSchedule;
  const journalEntries =
    eventType && eventfulPlanting
      ? [
          createPlantingEventJournalEntry({
            createdAtIso: completedAtIso,
            event: {
              id: `planting-event:${eventType}:${completedDate}`,
              occurredOn: completedDate,
              type: eventType,
            },
            gardenId: garden.id,
            plantingId: eventfulPlanting.id,
            plantingLabel: eventfulPlanting.label,
          }),
          ...garden.journalEntries,
        ]
      : garden.journalEntries;

  return synchronizeGardenTasks(
    {
      ...garden,
      journalEntries,
      plantings,
      tasks: updatedTasks,
      updatedAtIso: completedAtIso,
      wateringSchedule,
    },
    {
      now: completedAt,
      refreshOpenGenerated: true,
    },
  );
}

export function snoozeTask(
  garden: Garden,
  taskId: string,
  days: number,
  now = new Date(),
): Garden {
  const dueDate = addDays(toLocalDate(now), days);

  return updateTaskDate(garden, taskId, {
    deferredUntilDate: null,
    dueDate,
    snoozedUntilDate: dueDate,
  });
}

export function deferTask(
  garden: Garden,
  taskId: string,
  days: number,
): Garden {
  const task = garden.tasks.find((candidate) => candidate.id === taskId);

  if (!task?.dueDate) {
    return garden;
  }

  const dueDate = addDays(task.dueDate, days);

  return updateTaskDate(garden, taskId, {
    deferredUntilDate: dueDate,
    dueDate,
    snoozedUntilDate: null,
  });
}

export function addSuccessionTask(
  garden: Garden,
  recommendation: SuccessionRecommendation,
  now = new Date(),
): Garden {
  const existing = garden.tasks.some(
    (task) => task.id === `succession-${recommendation.id}`,
  );

  if (existing) {
    return garden;
  }

  const task = createTask(
    {
      bedLabel: recommendation.targetLabel,
      dueDate: recommendation.earliestDate,
      id: `succession-${recommendation.id}`,
      notes: recommendation.reason,
      plantingId: recommendation.plantingId,
      priority: 'medium',
      source: 'succession',
      sourceId: recommendation.cropId,
      title: `Succession sow ${recommendation.cropName}`,
      type: 'sow',
    },
    now,
  );

  return {
    ...garden,
    tasks: sortTasks([
      ...garden.tasks,
      {
        ...task,
        gardenId: garden.id,
      },
    ]),
    updatedAtIso: now.toISOString(),
  };
}

export function addSuccessionPlanting(
  garden: Garden,
  recommendation: SuccessionRecommendation,
  now = new Date(),
): Garden {
  const crop = getCropById(recommendation.cropId);
  const sourcePlanting = garden.plantings.find(
    (planting) => planting.id === recommendation.plantingId,
  );
  const id = getSuccessionPlantingId(recommendation);

  if (
    !crop ||
    !sourcePlanting ||
    garden.plantings.some((planting) => planting.id === id)
  ) {
    return garden;
  }

  const mode: Planting['mode'] = crop.supportedPlantingModes.includes('row')
    ? 'row'
    : 'single';
  const rowLengthFt =
    mode === 'row' ? Math.min(sourcePlanting.rowLengthFt ?? 4, 6) : null;
  const planting = withPlantingInstances({
    ...createDefaultPlanting({
      id,
      label: `${crop.commonName} succession`,
      xFt: sourcePlanting.xFt,
      yFt: sourcePlanting.yFt,
    }),
    cropId: crop.id,
    matureHeightInches: crop.matureHeightInches,
    matureSpreadInches: crop.matureSpreadInches,
    mode,
    notes: `Succession after ${sourcePlanting.label}. ${recommendation.reason}`,
    plantCount: estimateSuccessionPlantCount(crop, mode),
    plannedFor: recommendation.earliestDate,
    rowLengthFt,
    rowSpacingInches: crop.rowSpacingInches,
    spacingInches: crop.spacingInches,
    sunRequirement: crop.sunRequirement,
    weeklyWaterNeedInches: crop.weeklyWaterNeedInches,
  });

  return synchronizeGardenTasks(
    {
      ...garden,
      plantings: [...garden.plantings, planting],
      updatedAtIso: now.toISOString(),
    },
    { now, refreshOpenGenerated: true },
  );
}

export function getSuccessionPlantingId(
  recommendation: SuccessionRecommendation,
) {
  return `succession-planting-${recommendation.id}`;
}

export function addManualTask(
  garden: Garden,
  input: ManualTaskInput,
  now = new Date(),
): Garden {
  const task = createTask(
    {
      bedLabel: null,
      dueDate: input.dueDate,
      id: createTaskId('manual'),
      notes: input.notes,
      plantingId: null,
      priority: input.priority ?? 'medium',
      source: 'manual',
      sourceId: null,
      title: input.title,
      type: input.type,
    },
    now,
  );

  return {
    ...garden,
    tasks: sortTasks([
      ...garden.tasks,
      {
        ...task,
        gardenId: garden.id,
      },
    ]),
    updatedAtIso: now.toISOString(),
  };
}

export function buildSuccessionRecommendations(
  garden: Garden,
  now = new Date(),
): SuccessionRecommendation[] {
  const today = toLocalDate(now);
  const firstFrost = resolveFirstFrostDate(garden, today);

  return garden.plantings
    .flatMap((planting): SuccessionRecommendation[] => {
      const crop = getCropById(planting.cropId);

      if (!crop || planting.status === 'removed') {
        return [];
      }

      const harvestSchedule =
        planting.status === 'harvested'
          ? null
          : getPlantingHarvestSchedule(garden, planting, today);
      const earliestDate =
        planting.status === 'harvested'
          ? today
          : harvestSchedule?.expectedHarvestDate;

      if (!earliestDate) {
        return [];
      }
      const daysRemaining = differenceInDays(firstFrost, earliestDate);

      if (daysRemaining < 28) {
        return [];
      }

      const sunExposure = getSunExposureAtPlanting(garden, planting);
      const followOn = chooseSuccessionCrop(daysRemaining, sunExposure);

      if (!followOn) {
        return [];
      }

      return [
        {
          bedOpensOn: earliestDate,
          cropId: followOn.id,
          cropName: followOn.commonName,
          daysRemaining,
          earliestDate,
          id: `${planting.id}-${followOn.id}-${earliestDate}`,
          plantingId: planting.id,
          reason: `${daysRemaining} frost-free days remain after ${planting.label}. ${followOn.commonName} fits the remaining season and ${formatExposure(sunExposure)} exposure.`,
          sunExposure,
          targetLabel: getBedLabelForPlanting(garden, planting),
        },
      ];
    })
    .slice(0, 6);
}

export function tasksAreEqual(left: Task[], right: Task[]) {
  return JSON.stringify(sortTasks(left)) === JSON.stringify(sortTasks(right));
}

export function sortTasks(tasks: Task[]) {
  return [...tasks].sort((left, right) => {
    const leftDate = left.dueDate ?? '9999-12-31';
    const rightDate = right.dueDate ?? '9999-12-31';

    if (leftDate !== rightDate) {
      return leftDate.localeCompare(rightDate);
    }

    return left.title.localeCompare(right.title);
  });
}

function buildPlantingTasks(
  garden: Garden,
  planting: Planting,
  now: Date,
): Task[] {
  if (planting.status === 'harvested' || planting.status === 'removed') {
    return [];
  }

  const crop = getCropById(planting.cropId);
  const bedLabel = getBedLabelForPlanting(garden, planting);
  const anchorDate = getPlantingAnchorDate(garden, planting, crop, now);
  const startedInsideDate = getLatestPlantingEventDate(
    planting,
    'startedInside',
  );
  const directSowedDate = getLatestPlantingEventDate(planting, 'directSowed');
  const thinnedDate = getLatestPlantingEventDate(planting, 'thinned');
  const inGroundDate = getInGroundDate(planting);
  const tasks: Task[] = [];

  if (!inGroundDate && crop) {
    if (
      (crop.sowMethod === 'transplant' || crop.sowMethod === 'both') &&
      !startedInsideDate
    ) {
      tasks.push(
        createTask(
          {
            bedLabel,
            dueDate: addDays(anchorDate, -42),
            id: `planting-${planting.id}-seed-start`,
            notes: climateNote(garden, 'Seed start timing'),
            plantingId: planting.id,
            priority: 'medium',
            source: 'generated',
            sourceId: planting.id,
            title: `Start ${planting.label} indoors`,
            type: 'sow',
          },
          now,
        ),
      );
    }

    if (startedInsideDate) {
      const transplantDate = maxDate(
        anchorDate,
        addDays(startedInsideDate, 35),
      );
      const hardenOffDate = maxDate(
        addDays(startedInsideDate, 28),
        addDays(transplantDate, -7),
      );

      tasks.push(
        createTask(
          {
            bedLabel,
            dueDate: hardenOffDate,
            id: `planting-${planting.id}-harden-off`,
            notes: `Started indoors on ${startedInsideDate}. Begin hardening off before planting ${planting.label} out.`,
            plantingId: planting.id,
            source: 'generated',
            sourceId: planting.id,
            title: `Harden off ${planting.label}`,
            type: 'inspect',
          },
          now,
        ),
      );
      tasks.push(
        createTask(
          {
            bedLabel,
            dueDate: transplantDate,
            id: `planting-${planting.id}-plant`,
            notes: `Started indoors on ${startedInsideDate}. ${climateNote(garden, getPlantingInstruction(crop))}`,
            plantingId: planting.id,
            priority: crop.frostSensitive ? 'high' : 'medium',
            source: 'generated',
            sourceId: planting.id,
            title: `Plant out ${planting.label}`,
            type: 'transplant',
          },
          now,
        ),
      );
    } else {
      tasks.push(
        createTask(
          {
            bedLabel,
            dueDate: anchorDate,
            id: `planting-${planting.id}-plant`,
            notes: climateNote(garden, getPlantingInstruction(crop)),
            plantingId: planting.id,
            priority: crop.frostSensitive ? 'high' : 'medium',
            source: 'generated',
            sourceId: planting.id,
            title: `${getPlantingVerb(crop)} ${planting.label}`,
            type: getPlantingTaskType(crop),
          },
          now,
        ),
      );
    }
  }

  const seedlingCheckDate =
    directSowedDate ??
    startedInsideDate ??
    (startedInsideDate || inGroundDate ? null : anchorDate);
  const thinningDate =
    directSowedDate ?? (startedInsideDate || inGroundDate ? null : anchorDate);
  const careAnchorDate =
    inGroundDate ?? (startedInsideDate && !inGroundDate ? null : anchorDate);

  if (seedlingCheckDate && needsSeedlingCheck(crop)) {
    tasks.push(
      createTask(
        {
          bedLabel,
          dueDate: addDays(seedlingCheckDate, 7),
          id: `planting-${planting.id}-seedling-check`,
          notes: directSowedDate
            ? `Direct sowed on ${directSowedDate}. Check germination, moisture, pests, and gaps in ${bedLabel}.`
            : startedInsideDate
              ? `Started indoors on ${startedInsideDate}. Check seedling growth, moisture, and spacing before planting out.`
              : `Check germination, moisture, pests, and gaps in ${bedLabel}. This follows the saved ${crop?.commonName ?? planting.label} sowing date.`,
          plantingId: planting.id,
          source: 'generated',
          sourceId: planting.id,
          title: `Check ${planting.label} seedlings`,
          type: 'inspect',
        },
        now,
      ),
    );
  }

  if (thinningDate && !thinnedDate && needsThinning(planting, crop)) {
    tasks.push(
      createTask(
        {
          bedLabel,
          dueDate: addDays(thinningDate, 14),
          id: `planting-${planting.id}-thin`,
          notes: directSowedDate
            ? `Direct sowed on ${directSowedDate}. Thin crowded seedlings in ${bedLabel} to ${formatSpacing(crop)} spacing so the planting can mature.`
            : `Thin crowded seedlings in ${bedLabel} to ${formatSpacing(crop)} spacing so the saved planting can mature.`,
          plantingId: planting.id,
          source: 'generated',
          sourceId: planting.id,
          title: `Thin ${planting.label}`,
          type: 'thin',
        },
        now,
      ),
    );
  }

  if (careAnchorDate && needsTrellis(planting, crop)) {
    tasks.push(
      createTask(
        {
          bedLabel,
          dueDate: addDays(careAnchorDate, 7),
          id: `planting-${planting.id}-trellis`,
          notes:
            'Install support before vines elongate and roots fill the bed.',
          plantingId: planting.id,
          priority: 'high',
          source: 'generated',
          sourceId: planting.id,
          title: `Set support for ${planting.label}`,
          type: 'trellis',
        },
        now,
      ),
    );
  }

  if (careAnchorDate && !planting.mulched) {
    tasks.push(
      createTask(
        {
          bedLabel,
          dueDate: addDays(careAnchorDate, 10),
          id: `planting-${planting.id}-mulch`,
          notes:
            'Mulch after seedlings establish to reduce evaporation and weeds.',
          plantingId: planting.id,
          source: 'generated',
          sourceId: planting.id,
          title: `Mulch ${planting.label}`,
          type: 'mulch',
        },
        now,
      ),
    );
  }

  if (careAnchorDate && needsFertilizer(crop)) {
    tasks.push(
      createTask(
        {
          bedLabel,
          dueDate: addDays(careAnchorDate, 28),
          id: `planting-${planting.id}-fertilize`,
          notes: 'Side-dress or feed once active growth is underway.',
          plantingId: planting.id,
          source: 'generated',
          sourceId: planting.id,
          title: `Feed ${planting.label}`,
          type: 'fertilize',
        },
        now,
      ),
    );
  }

  if (careAnchorDate && needsPruning(crop)) {
    tasks.push(
      createTask(
        {
          bedLabel,
          dueDate: addDays(careAnchorDate, 35),
          id: `planting-${planting.id}-prune`,
          notes: 'Inspect growth and prune lightly for airflow and access.',
          plantingId: planting.id,
          source: 'generated',
          sourceId: planting.id,
          title: `Prune and inspect ${planting.label}`,
          type: 'prune',
        },
        now,
      ),
    );
  }

  return tasks;
}

function buildWaterTask(
  garden: Garden,
  recommendation: WateringScheduleEntry,
  now: Date,
): Task[] {
  if (
    recommendation.status === 'suppressed' ||
    recommendation.status === 'completed' ||
    recommendation.status === 'skipped' ||
    recommendation.targetAmountInches <= 0
  ) {
    return [];
  }

  return [
    createTask(
      {
        bedLabel: getBedLabelForRecommendation(garden, recommendation),
        dueDate: recommendation.dueDate,
        id: `water-${recommendation.id}`,
        notes: buildWaterTaskNotes(recommendation),
        plantingId:
          recommendation.targetKind === 'planting'
            ? recommendation.targetId
            : null,
        priority: recommendation.urgency === 'high' ? 'high' : 'medium',
        source: 'wateringSchedule',
        sourceId: recommendation.id,
        structureId:
          recommendation.targetKind === 'bed' ? recommendation.targetId : null,
        title: `Water ${formatWaterTaskTarget(recommendation)} ${formatInches(recommendation.targetAmountInches)} in`,
        type: 'water',
      },
      now,
    ),
  ];
}

function buildWeatherTasks(garden: Garden, now: Date): Task[] {
  const latestWeather = getLatestWeatherSnapshot(garden);

  if (!latestWeather) {
    return [];
  }

  const today = toLocalDate(now);
  const dueDate =
    latestWeather.observedForDate > today
      ? latestWeather.observedForDate
      : today;
  const tasks: Task[] = [];

  if (latestWeather.frostRisk !== 'none') {
    tasks.push(
      createTask(
        {
          bedLabel: 'Whole garden',
          dueDate,
          id: `weather-${latestWeather.id}-frost`,
          notes: `Frost ${latestWeather.frostRisk} from ${latestWeather.providerLabel ?? latestWeather.source}. Overnight low ${formatNullableTemperature(latestWeather.overnightLowF)}; cover tender crops and close cold frames before evening.`,
          plantingId: null,
          priority: 'high',
          source: 'generated',
          sourceId: latestWeather.id,
          title: 'Cover tender crops before frost risk',
          type: 'inspect',
        },
        now,
      ),
    );
  }

  if (latestWeather.heatRisk !== 'none') {
    tasks.push(
      createTask(
        {
          bedLabel: 'Whole garden',
          dueDate,
          id: `weather-${latestWeather.id}-heat`,
          notes: `Heat ${latestWeather.heatRisk} from ${latestWeather.providerLabel ?? latestWeather.source}. ${latestWeather.conditionSummary}; check shallow-rooted crops, containers, and recent transplants before afternoon stress.`,
          plantingId: null,
          priority: latestWeather.heatRisk === 'warning' ? 'high' : 'medium',
          source: 'generated',
          sourceId: latestWeather.id,
          title: 'Check heat-stressed crops',
          type: 'inspect',
        },
        now,
      ),
    );
  }

  latestWeather.alertSummaries.slice(0, 1).forEach((summary, index) => {
    tasks.push(
      createTask(
        {
          bedLabel: 'Whole garden',
          dueDate,
          id: `weather-${latestWeather.id}-alert-${index}`,
          notes: `${summary} Weather snapshot observed ${latestWeather.observedForDate}; inspect the garden while conditions are current.`,
          plantingId: null,
          priority: 'medium',
          source: 'generated',
          sourceId: latestWeather.id,
          title: 'Check garden weather risk',
          type: 'inspect',
        },
        now,
      ),
    );
  });

  return tasks;
}

function createTask(input: TaskInput, now: Date): Task {
  return {
    bedLabel: input.bedLabel,
    completedAtIso: null,
    createdAtIso: now.toISOString(),
    deferredUntilDate: null,
    dueDate: input.dueDate,
    gardenId: '',
    id: input.id,
    notes: input.notes,
    plantingId: input.plantingId,
    priority: input.priority ?? 'medium',
    snoozedUntilDate: null,
    source: input.source,
    sourceId: input.sourceId,
    status: 'open',
    structureId: input.structureId ?? null,
    title: input.title,
    type: input.type,
  };
}

function createTaskId(prefix: string) {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }

  return `${prefix}-${Date.now()}`;
}

function shouldRefreshTask(task: Task, options: SynchronizeOptions) {
  return (
    Boolean(options.refreshOpenGenerated) &&
    task.status === 'open' &&
    (task.source === 'generated' || task.source === 'wateringSchedule') &&
    !task.snoozedUntilDate &&
    !task.deferredUntilDate
  );
}

function shouldRetireStaleGeneratedTask(
  task: Task,
  generated: Task | undefined,
) {
  return (
    !generated &&
    task.status === 'open' &&
    (task.source === 'generated' || task.source === 'wateringSchedule')
  );
}

function getGeneratedTaskKey(task: Task) {
  if (task.source !== 'generated' && task.source !== 'wateringSchedule') {
    return null;
  }

  if (
    task.source === 'generated' &&
    !task.plantingId &&
    !task.structureId &&
    task.sourceId
  ) {
    return [task.source, task.type, task.sourceId, task.title].join(':');
  }

  return [
    task.source,
    task.type,
    task.sourceId ?? '',
    task.plantingId ?? '',
    task.structureId ?? '',
  ].join(':');
}

function shouldClearSetupTask(
  candidate: Task,
  completedTask: Task,
  completedDate: LocalDateString,
) {
  const setupTypes: TaskType[] = ['plant', 'sow', 'transplant'];

  return (
    candidate.status === 'open' &&
    candidate.id !== completedTask.id &&
    candidate.plantingId === completedTask.plantingId &&
    setupTypes.includes(candidate.type) &&
    setupTypes.includes(completedTask.type) &&
    Boolean(candidate.dueDate && candidate.dueDate <= completedDate)
  );
}

function updateTaskDate(
  garden: Garden,
  taskId: string,
  values: Pick<Task, 'deferredUntilDate' | 'dueDate' | 'snoozedUntilDate'>,
): Garden {
  const now = new Date().toISOString();

  return {
    ...garden,
    tasks: sortTasks(
      garden.tasks.map((task) =>
        task.id === taskId
          ? {
              ...task,
              ...values,
              status: 'open',
            }
          : task,
      ),
    ),
    updatedAtIso: now,
  };
}

function getPlantingAnchorDate(
  garden: Garden,
  planting: Planting,
  crop: CropProfile | null,
  now: Date,
): LocalDateString {
  if (planting.plantedOn) {
    return planting.plantedOn;
  }

  if (planting.plannedFor) {
    return planting.plannedFor;
  }

  const today = toLocalDate(now);
  const lastFrost = resolveLastFrostDate(garden, today);

  if (!crop) {
    return lastFrost;
  }

  const warmSeason = crop.frostSensitive || /warm-season/i.test(crop.hardiness);

  if (crop.sowMethod === 'transplant') {
    return addDays(lastFrost, warmSeason ? 7 : -14);
  }

  if (crop.sowMethod === 'directSow') {
    return addDays(lastFrost, warmSeason ? 7 : -28);
  }

  return addDays(lastFrost, warmSeason ? 7 : -21);
}

function getPlantingVerb(crop: CropProfile) {
  if (crop.sowMethod === 'transplant') {
    return 'Transplant';
  }

  if (crop.sowMethod === 'directSow') {
    return 'Direct sow';
  }

  return 'Plant';
}

function getPlantingTaskType(crop: CropProfile): TaskType {
  if (crop.sowMethod === 'transplant') {
    return 'transplant';
  }

  if (crop.sowMethod === 'directSow') {
    return 'sow';
  }

  return 'plant';
}

function getPlantingInstruction(crop: CropProfile) {
  if (crop.sowMethod === 'transplant') {
    return 'Transplant timing';
  }

  if (crop.sowMethod === 'directSow') {
    return 'Direct sow timing';
  }

  return 'Planting timing';
}

function needsThinning(planting: Planting, crop: CropProfile | null) {
  return (
    (crop?.sowMethod === 'directSow' || crop?.sowMethod === 'both') &&
    (planting.mode === 'row' ||
      planting.mode === 'block' ||
      planting.mode === 'cluster' ||
      (planting.plantCount ?? 0) > 1)
  );
}

function needsSeedlingCheck(crop: CropProfile | null) {
  return crop?.sowMethod === 'directSow' || crop?.sowMethod === 'both';
}

function needsTrellis(planting: Planting, crop: CropProfile | null) {
  return (
    planting.mode === 'trellisLine' ||
    crop?.trellisRecommended ||
    crop?.growthForm === 'vining' ||
    crop?.growthForm === 'climber'
  );
}

function needsFertilizer(crop: CropProfile | null) {
  return (
    crop?.category === 'fruit' ||
    crop?.waterNeeds === 'high' ||
    crop?.growthForm === 'vining'
  );
}

function needsPruning(crop: CropProfile | null) {
  return (
    crop?.growthForm === 'vining' ||
    crop?.growthForm === 'climber' ||
    crop?.id.includes('tomato') === true
  );
}

function estimateSuccessionPlantCount(
  crop: CropProfile,
  mode: Planting['mode'],
) {
  if (mode !== 'row') {
    return 1;
  }

  return Math.max(Math.floor(48 / Math.max(crop.spacingInches ?? 12, 4)), 1);
}

function buildWaterTaskNotes(recommendation: WateringScheduleEntry) {
  return (
    recommendation.reasonDetails.join(' ') ||
    `${recommendation.targetLabel} has ${formatInches(recommendation.targetAmountInches)} still due.`
  );
}

function formatWaterTaskTarget(recommendation: WateringScheduleEntry) {
  if (recommendation.targetKind !== 'bed') {
    return recommendation.targetLabel;
  }

  return recommendation.targetLabel.replace(/^./, (letter) =>
    letter.toLowerCase(),
  );
}

function getLatestWeatherSnapshot(garden: Garden): WeatherSnapshot | null {
  return garden.weatherSnapshots.reduce<WeatherSnapshot | null>(
    (latestSnapshot, snapshot) =>
      latestSnapshot === null ||
      snapshot.capturedAtIso >= latestSnapshot.capturedAtIso
        ? snapshot
        : latestSnapshot,
    null,
  );
}

function formatSpacing(crop: CropProfile | null) {
  return crop?.spacingInches ? `${crop.spacingInches} in` : 'saved crop';
}

function formatInches(value: number) {
  return Number.isInteger(value) ? `${value}` : value.toFixed(2);
}

function formatNullableTemperature(value: number | null) {
  return value === null ? 'unknown' : `${value}F`;
}

function chooseSuccessionCrop(
  daysRemaining: number,
  sunExposure: SunExposure | null,
) {
  if (sunExposure === 'fullSun' && daysRemaining >= 55) {
    return getCropById('bush-bean');
  }

  if (
    (sunExposure === 'partShade' || sunExposure === 'partSun') &&
    daysRemaining >= 45
  ) {
    return getCropById('lettuce') ?? getCropById('spinach');
  }

  if (daysRemaining >= 35) {
    return getCropById('spinach') ?? getCropById('arugula');
  }

  return getCropById('radish');
}

function getBedLabelForRecommendation(
  garden: Garden,
  recommendation: WateringScheduleEntry,
) {
  if (recommendation.targetKind === 'bed') {
    return recommendation.targetLabel;
  }

  const planting = garden.plantings.find(
    (candidate) => candidate.id === recommendation.targetId,
  );

  return planting ? getBedLabelForPlanting(garden, planting) : 'Open plot';
}

function getBedLabelForPlanting(garden: Garden, planting: Planting) {
  const bed = garden.structures.find(
    (structure) =>
      isBedLike(structure) && containsPlanting(structure, planting),
  );

  return bed?.label ?? 'Open plot';
}

function isBedLike(structure: Structure) {
  return (
    structure.type === 'bed' ||
    structure.type === 'container' ||
    structure.type === 'inGroundBed' ||
    structure.type === 'raisedBed'
  );
}

function containsPlanting(structure: Structure, planting: Planting) {
  return (
    planting.xFt >= structure.xFt &&
    planting.xFt <= structure.xFt + structure.widthFt &&
    planting.yFt >= structure.yFt &&
    planting.yFt <= structure.yFt + structure.depthFt
  );
}

function getSunExposureAtPlanting(garden: Garden, planting: Planting) {
  const layers = [...garden.sunShadeLayers].sort((left, right) =>
    left.season === 'fall' ? -1 : right.season === 'fall' ? 1 : 0,
  );

  for (const layer of layers) {
    const area = layer.areas.find(
      (candidate) =>
        planting.xFt >= candidate.xFt &&
        planting.xFt < candidate.xFt + candidate.widthFt &&
        planting.yFt >= candidate.yFt &&
        planting.yFt < candidate.yFt + candidate.depthFt,
    );

    if (area) {
      return area.exposure;
    }
  }

  return planting.sunRequirement;
}

function climateNote(garden: Garden, label: string) {
  return `${label} uses editable climate defaults for ${garden.climateProfile.locationName}, zone ${garden.climateProfile.hardinessZone}: last frost ${garden.climateProfile.averageLastFrost}, first frost ${garden.climateProfile.averageFirstFrost}.`;
}

function formatExposure(exposure: SunExposure | null) {
  if (!exposure) {
    return 'saved';
  }

  return exposure.replace(/[A-Z]/g, (letter) => ` ${letter.toLowerCase()}`);
}

function resolveLastFrostDate(garden: Garden, today: LocalDateString) {
  const year = getSchedulingYear(garden, today);

  return dateFromMonthDay(year, garden.climateProfile.averageLastFrost);
}

function resolveFirstFrostDate(garden: Garden, today: LocalDateString) {
  const year = getSchedulingYear(garden, today);
  const firstFrost = dateFromMonthDay(
    year,
    garden.climateProfile.averageFirstFrost,
  );

  return firstFrost < today
    ? dateFromMonthDay(year + 1, garden.climateProfile.averageFirstFrost)
    : firstFrost;
}

function getSchedulingYear(garden: Garden, today: LocalDateString) {
  const year = Number(today.slice(0, 4));
  const firstFrost = dateFromMonthDay(
    year,
    garden.climateProfile.averageFirstFrost,
  );

  return today > addDays(firstFrost, 14) ? year + 1 : year;
}

function dateFromMonthDay(year: number, monthDay: string): LocalDateString {
  const [month = '1', day = '1'] = monthDay.split('-');

  return toLocalDate(new Date(Date.UTC(year, Number(month) - 1, Number(day))));
}

function addDays(date: LocalDateString, days: number): LocalDateString {
  return toLocalDate(new Date(parseLocalDate(date).getTime() + days * dayMs));
}

function maxDate(
  left: LocalDateString,
  right: LocalDateString,
): LocalDateString {
  return left >= right ? left : right;
}

function differenceInDays(
  later: LocalDateString,
  earlier: LocalDateString,
): number {
  return Math.round(
    (parseLocalDate(later).getTime() - parseLocalDate(earlier).getTime()) /
      dayMs,
  );
}

function parseLocalDate(date: LocalDateString) {
  const [year = '1970', month = '1', day = '1'] = date.split('-');

  return new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
}

function toLocalDate(date: Date): LocalDateString {
  return date.toISOString().slice(0, 10);
}
