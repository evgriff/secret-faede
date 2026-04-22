import type {
  Garden,
  JournalEntry,
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
  const lifecycleNote = createLifecycleJournalEntry({
    garden,
    nowIso,
    occurredOn,
    planting,
    status,
  });
  const updatedGarden = {
    ...garden,
    journalEntries: [lifecycleNote, ...garden.journalEntries],
    plantings: garden.plantings.map((candidate) =>
      candidate.id === planting.id
        ? {
            ...candidate,
            plantedOn:
              shouldStampPlantedOn && !candidate.plantedOn
                ? occurredOn
                : candidate.plantedOn,
            status,
          }
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
  planting,
  status,
}: {
  garden: Garden;
  nowIso: string;
  occurredOn: string;
  planting: Garden['plantings'][number];
  status: PlantingLifecycleStatus;
}): JournalEntry {
  const statusLabel = formatLifecycleStatus(status);

  return {
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
    targetType: 'planting',
    title: `Marked ${planting.label} ${statusLabel.toLowerCase()}`,
    type: 'note',
    weatherSnapshotId: null,
  };
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
