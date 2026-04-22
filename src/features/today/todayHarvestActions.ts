import type { Garden, Task } from '../../domain/gardens/GardenRepository';
import { sortTasks, synchronizeGardenTasks } from '../tasks/taskEngine';
import { createTodayId } from './todayActions';
import { getBedLabelForPlanting } from './todayGardenLabels';

export interface TodayHarvestDelayInput {
  delayUntilDate: string;
  plantingId: string;
  reason: string;
}

export function delayHarvestReminder(
  garden: Garden,
  input: TodayHarvestDelayInput,
  now = new Date(),
): Garden {
  const planting = garden.plantings.find(
    (candidate) => candidate.id === input.plantingId,
  );

  if (!planting) {
    return garden;
  }

  const nowIso = now.toISOString();
  let matchedOpenReminder = false;
  const tasks = garden.tasks.map((task) => {
    if (
      task.type !== 'harvest' ||
      task.status !== 'open' ||
      task.plantingId !== planting.id
    ) {
      return task;
    }

    matchedOpenReminder = true;

    return {
      ...task,
      delayReason: input.reason,
      delaySetAtIso: nowIso,
      deferredUntilDate: input.delayUntilDate,
      dueDate: input.delayUntilDate,
      notes: withHarvestDelayNote(task.notes, input.reason),
      snoozedUntilDate: null,
    };
  });
  const scheduledTasks = matchedOpenReminder
    ? tasks
    : [...tasks, createDelayedHarvestTask(garden, planting, input, nowIso)];

  return synchronizeGardenTasks(
    {
      ...garden,
      plantings: garden.plantings.map((candidate) =>
        candidate.id === planting.id && candidate.status === 'harvest-ready'
          ? { ...candidate, status: 'growing' as const }
          : candidate,
      ),
      tasks: sortTasks(scheduledTasks),
      updatedAtIso: nowIso,
    },
    { now, refreshOpenGenerated: true },
  );
}

function createDelayedHarvestTask(
  garden: Garden,
  planting: Garden['plantings'][number],
  input: TodayHarvestDelayInput,
  nowIso: string,
): Task {
  const generatedHarvestId = `planting-${planting.id}-harvest`;
  const canUseGeneratedId = !garden.tasks.some(
    (task) => task.id === generatedHarvestId,
  );

  return {
    bedLabel: getBedLabelForPlanting(garden, planting),
    completedAtIso: null,
    createdAtIso: nowIso,
    delayReason: input.reason,
    delaySetAtIso: nowIso,
    deferredUntilDate: input.delayUntilDate,
    dueDate: input.delayUntilDate,
    gardenId: garden.id,
    id: canUseGeneratedId ? generatedHarvestId : createTodayId('harvest-delay'),
    notes: withHarvestDelayNote(
      `Check ${planting.label} again before picking.`,
      input.reason,
    ),
    plantingId: planting.id,
    priority: 'medium',
    snoozedUntilDate: null,
    source: canUseGeneratedId ? 'generated' : 'manual',
    sourceId: planting.id,
    status: 'open',
    structureId: null,
    title: `Check ${planting.label} for harvest`,
    type: 'harvest',
  };
}

function withHarvestDelayNote(notes: string, reason: string) {
  const baseNotes = notes.replace(/\s*Not ready:.*$/u, '').trim();
  const delayNote = `Not ready: ${reason}`;

  return [baseNotes, delayNote].filter(Boolean).join(' ');
}
