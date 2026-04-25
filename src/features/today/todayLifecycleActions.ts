import {
  appendPlantingEvent,
  createPlantingEvent,
  createPlantingEventJournalEntry,
  getLatestPlantingEventDate,
  type PlantingEventType,
} from '../../domain/gardens/GardenRepository';
import type {
  Garden,
  PlantingLifecycleStatus,
  Task,
} from '../../domain/gardens/GardenRepository';
import { synchronizeGardenTasks } from '../tasks/taskEngine';
import { createTodayId } from './todayActions';
import { toLocalDate } from './todayFormatters';

export function markPlantingLifecycle(
  garden: Garden,
  plantingId: string,
  status: PlantingLifecycleStatus,
  now = new Date(),
): Garden {
  const planting = garden.plantings.find(
    (candidate) => candidate.id === plantingId,
  );

  if (!planting || planting.status === status) {
    return garden;
  }

  const nowIso = now.toISOString();
  const occurredOn = toLocalDate(now);
  const shouldStampPlantedOn = [
    'planted',
    'growing',
    'harvest-ready',
    'harvested',
  ].includes(status);
  const plantingEventType = getLifecycleEventType(planting, status);
  const lifecycleNote = createLifecycleJournalEntry({
    garden,
    nowIso,
    occurredOn,
    eventType: plantingEventType,
    planting,
    status,
  });
  const updatedGarden = {
    ...garden,
    journalEntries: [lifecycleNote, ...garden.journalEntries],
    plantings: garden.plantings.map((candidate) =>
      candidate.id === planting.id
        ? applyLifecycleUpdate(
            candidate,
            occurredOn,
            nowIso,
            plantingEventType,
            shouldStampPlantedOn,
            status,
          )
        : candidate,
    ),
    tasks: garden.tasks.map((task) =>
      shouldCompleteSetupTask(task, planting.id, status)
        ? {
            ...task,
            completedAtIso: nowIso,
            status: 'done' as const,
          }
        : task,
    ),
    updatedAtIso: nowIso,
  };

  return synchronizeGardenTasks(updatedGarden, {
    now,
    refreshOpenGenerated: true,
  });
}

function createLifecycleJournalEntry({
  garden,
  nowIso,
  occurredOn,
  eventType,
  planting,
  status,
}: {
  garden: Garden;
  nowIso: string;
  occurredOn: string;
  eventType: PlantingEventType | null;
  planting: Garden['plantings'][number];
  status: PlantingLifecycleStatus;
}) {
  const event = eventType
    ? createPlantingEvent({
        occurredOn,
        type: eventType,
      })
    : null;
  const statusLabel = formatLifecycleStatus(status);

  return event
    ? createPlantingEventJournalEntry({
        createdAtIso: nowIso,
        event,
        gardenId: garden.id,
        plantingId: planting.id,
        plantingLabel: planting.label,
      })
    : {
        body: `${planting.label} was marked ${statusLabel.toLowerCase()} from Today.`,
        createdAtIso: nowIso,
        gardenId: garden.id,
        id: createTodayId('lifecycle'),
        issueCategory: null,
        issueSeverity: null,
        issueStatus: null,
        occurredOn,
        photos: [],
        plantingId: planting.id,
        structureId: null,
        targetLabel: planting.label,
        targetType: 'planting' as const,
        title: `Marked ${planting.label} ${statusLabel.toLowerCase()}`,
        type: 'note' as const,
        weatherSnapshotId: null,
      };
}

function applyLifecycleUpdate(
  planting: Garden['plantings'][number],
  occurredOn: string,
  nowIso: string,
  eventType: PlantingEventType | null,
  shouldStampPlantedOn: boolean,
  status: PlantingLifecycleStatus,
) {
  const eventfulPlanting = eventType
    ? appendPlantingEvent(planting, {
        nowIso,
        occurredOn,
        type: eventType,
      })
    : planting;

  return {
    ...eventfulPlanting,
    plantStatus: {
      ...eventfulPlanting.plantStatus,
      lifecycle: status,
    },
    plantedOn:
      shouldStampPlantedOn && !eventfulPlanting.plantedOn
        ? occurredOn
        : eventfulPlanting.plantedOn,
    status,
  };
}

function getLifecycleEventType(
  planting: Garden['plantings'][number],
  status: PlantingLifecycleStatus,
): PlantingEventType | null {
  if (
    status === 'planted' &&
    !getLatestPlantingEventDate(planting, 'plantedOut') &&
    !getLatestPlantingEventDate(planting, 'directSowed')
  ) {
    return 'plantedOut';
  }

  return null;
}

function shouldCompleteSetupTask(
  task: Task,
  plantingId: string,
  status: PlantingLifecycleStatus,
) {
  return (
    ['planted', 'growing', 'harvest-ready'].includes(status) &&
    task.status === 'open' &&
    task.plantingId === plantingId &&
    ['plant', 'sow', 'transplant'].includes(task.type)
  );
}

function formatLifecycleStatus(status: PlantingLifecycleStatus) {
  const labels: Record<PlantingLifecycleStatus, string> = {
    growing: 'Growing',
    'harvest-ready': 'Harvest-ready',
    harvested: 'Harvested',
    planned: 'Planned',
    planted: 'Planted',
    removed: 'Removed',
  };

  return labels[status];
}
