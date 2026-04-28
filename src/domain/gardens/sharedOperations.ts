import type {
  Garden,
  HarvestEvent,
  IsoDateString,
  JournalEntry,
  NotificationLog,
  Task,
  WateringScheduleEntry,
  WeatherSnapshot,
} from './models';

export interface GardenActivityActor {
  displayName: string | null;
  email: string;
  userId: string;
}

export interface SharedGardenOperations {
  harvestEvents: HarvestEvent[];
  journalEntries: JournalEntry[];
  notificationLogs: NotificationLog[];
  tasks: Task[];
  wateringSchedule: WateringScheduleEntry[];
  weatherSnapshots: WeatherSnapshot[];
}

export function createEmptySharedGardenOperations(): SharedGardenOperations {
  return {
    harvestEvents: [],
    journalEntries: [],
    notificationLogs: [],
    tasks: [],
    wateringSchedule: [],
    weatherSnapshots: [],
  };
}

export function getSharedGardenOperations(
  garden: Garden,
): SharedGardenOperations {
  return {
    harvestEvents: garden.harvestEvents,
    journalEntries: garden.journalEntries,
    notificationLogs: garden.notificationLogs,
    tasks: garden.tasks,
    wateringSchedule: garden.wateringSchedule,
    weatherSnapshots: garden.weatherSnapshots,
  };
}

export function stripSharedGardenOperations(garden: Garden): Garden {
  return {
    ...garden,
    harvestEvents: [],
    journalEntries: [],
    notificationLogs: [],
    tasks: [],
    wateringSchedule: [],
    weatherSnapshots: [],
  };
}

export function overlaySharedGardenOperations(
  garden: Garden,
  operations: SharedGardenOperations,
): Garden {
  if (!hasSharedGardenOperations(operations)) {
    return garden;
  }

  return {
    ...garden,
    harvestEvents: operations.harvestEvents.map((harvest) => ({
      ...harvest,
      gardenId: garden.id,
    })),
    journalEntries: operations.journalEntries.map((entry) => ({
      ...entry,
      gardenId: garden.id,
    })),
    notificationLogs: operations.notificationLogs.map((log) => ({
      ...log,
      gardenId: garden.id,
    })),
    tasks: operations.tasks.map((task) => ({
      ...task,
      gardenId: garden.id,
    })),
    wateringSchedule: operations.wateringSchedule.map((entry) => ({
      ...entry,
      gardenId: garden.id,
    })),
    weatherSnapshots: operations.weatherSnapshots.map((snapshot) => ({
      ...snapshot,
      gardenId: garden.id,
    })),
  };
}

export function hasSharedGardenOperations(operations: SharedGardenOperations) {
  return (
    operations.harvestEvents.length > 0 ||
    operations.journalEntries.length > 0 ||
    operations.notificationLogs.length > 0 ||
    operations.tasks.length > 0 ||
    operations.wateringSchedule.length > 0 ||
    operations.weatherSnapshots.length > 0
  );
}

export function mergeSharedGardenOperations(
  ...sources: Array<Partial<SharedGardenOperations> | null | undefined>
): SharedGardenOperations {
  return {
    harvestEvents: mergeById(
      sources.flatMap((source) => source?.harvestEvents ?? []),
      (left, right) =>
        getActivitySortKey(right, right.harvestedOn).localeCompare(
          getActivitySortKey(left, left.harvestedOn),
        ),
    ),
    journalEntries: mergeById(
      sources.flatMap((source) => source?.journalEntries ?? []),
      (left, right) =>
        getActivitySortKey(right, right.occurredOn).localeCompare(
          getActivitySortKey(left, left.occurredOn),
        ),
    ),
    notificationLogs: mergeById(
      sources.flatMap((source) => source?.notificationLogs ?? []),
      (left, right) =>
        String(right.createdAtIso ?? '').localeCompare(
          String(left.createdAtIso ?? ''),
        ),
    ),
    tasks: mergeById(
      sources.flatMap((source) => source?.tasks ?? []),
      (left, right) =>
        String(right.createdAtIso ?? '').localeCompare(
          String(left.createdAtIso ?? ''),
        ),
    ),
    wateringSchedule: mergeById(
      sources.flatMap((source) => source?.wateringSchedule ?? []),
      (left, right) =>
        String(right.updatedAtIso ?? '').localeCompare(
          String(left.updatedAtIso ?? ''),
        ),
    ),
    weatherSnapshots: mergeById(
      sources.flatMap((source) => source?.weatherSnapshots ?? []),
      (left, right) =>
        String(right.capturedAtIso ?? '').localeCompare(
          String(left.capturedAtIso ?? ''),
        ),
    ),
  };
}

export function applyActorToNewSharedOperations({
  actor,
  baseGarden,
  updatedGarden,
}: {
  actor: GardenActivityActor;
  baseGarden: Garden;
  updatedGarden: Garden;
}): Garden {
  const baseJournalEntryIds = new Set(
    baseGarden.journalEntries.map((entry) => entry.id),
  );
  const baseHarvestIds = new Set(
    baseGarden.harvestEvents.map((harvest) => harvest.id),
  );
  const baseTaskIds = new Set(baseGarden.tasks.map((task) => task.id));

  return {
    ...updatedGarden,
    harvestEvents: updatedGarden.harvestEvents.map((harvest) =>
      baseHarvestIds.has(harvest.id) ? harvest : withCreatedBy(harvest, actor),
    ),
    journalEntries: updatedGarden.journalEntries.map((entry) =>
      baseJournalEntryIds.has(entry.id) ? entry : withCreatedBy(entry, actor),
    ),
    tasks: updatedGarden.tasks.map((task) => {
      const baseTask = baseGarden.tasks.find(
        (candidate) => candidate.id === task.id,
      );

      if (!baseTaskIds.has(task.id)) {
        return withCreatedBy(task, actor);
      }

      if (
        baseTask?.status !== 'done' &&
        task.status === 'done' &&
        task.completedAtIso
      ) {
        return {
          ...task,
          completedByDisplayName: actor.displayName,
          completedByEmail: actor.email,
          completedByUserId: actor.userId,
        };
      }

      return task;
    }),
  };
}

export function applySharedGardenOperationsPatch({
  base,
  current,
  updated,
}: {
  base: SharedGardenOperations;
  current: SharedGardenOperations;
  updated: SharedGardenOperations;
}): SharedGardenOperations {
  return mergeSharedGardenOperations({
    harvestEvents: patchArray(
      current.harvestEvents,
      base.harvestEvents,
      updated.harvestEvents,
    ),
    journalEntries: patchArray(
      current.journalEntries,
      base.journalEntries,
      updated.journalEntries,
    ),
    notificationLogs: patchArray(
      current.notificationLogs,
      base.notificationLogs,
      updated.notificationLogs,
    ),
    tasks: patchArray(current.tasks, base.tasks, updated.tasks),
    wateringSchedule: patchArray(
      current.wateringSchedule,
      base.wateringSchedule,
      updated.wateringSchedule,
    ),
    weatherSnapshots: patchArray(
      current.weatherSnapshots,
      base.weatherSnapshots,
      updated.weatherSnapshots,
    ),
  });
}

function withCreatedBy<T extends object>(value: T, actor: GardenActivityActor) {
  return {
    ...value,
    createdByDisplayName: actor.displayName,
    createdByEmail: actor.email,
    createdByUserId: actor.userId,
  };
}

function mergeById<T extends { id: string }>(
  values: T[],
  sortItems: (left: T, right: T) => number,
) {
  const byId = new Map<string, T>();

  for (const value of values) {
    const current = byId.get(value.id);

    if (!current || getRevisionHint(value) >= getRevisionHint(current)) {
      byId.set(value.id, value);
    }
  }

  return [...byId.values()].sort(sortItems);
}

function patchArray<T extends { id: string }>(
  current: T[],
  base: T[],
  updated: T[],
) {
  const nextById = new Map(current.map((item) => [item.id, item] as const));
  const baseById = new Map(base.map((item) => [item.id, item] as const));
  const updatedById = new Map(updated.map((item) => [item.id, item] as const));

  for (const item of updated) {
    const baseItem = baseById.get(item.id);

    if (!baseItem || !sameData(baseItem, item)) {
      nextById.set(item.id, item);
    }
  }

  for (const item of base) {
    if (!updatedById.has(item.id)) {
      nextById.delete(item.id);
    }
  }

  return [...nextById.values()];
}

function sameData(left: unknown, right: unknown) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function getRevisionHint(value: object) {
  const record = value as {
    capturedAtIso?: IsoDateString;
    completedAtIso?: IsoDateString | null;
    createdAtIso?: IsoDateString;
    harvestedOn?: string;
    occurredOn?: string;
    sentAtIso?: IsoDateString | null;
    updatedAtIso?: IsoDateString;
  };

  return String(
    record.updatedAtIso ??
      record.completedAtIso ??
      record.sentAtIso ??
      record.capturedAtIso ??
      record.createdAtIso ??
      record.harvestedOn ??
      record.occurredOn ??
      '',
  );
}

function getActivitySortKey(value: object, fallbackDate: string) {
  const createdAtIso =
    'createdAtIso' in value && typeof value.createdAtIso === 'string'
      ? value.createdAtIso
      : null;

  return createdAtIso || `${fallbackDate}T12:00:00.000Z`;
}
