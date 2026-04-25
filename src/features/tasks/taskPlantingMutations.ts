import {
  appendPlantingEvent,
  type LocalDateString,
  type Planting,
  type PlantingEventType,
  type Task,
} from '../../domain/gardens/GardenRepository';

export function updatePlantingFromCompletedTask(
  planting: Planting,
  task: Task,
  completedDate: LocalDateString,
  completedAtIso: string,
  eventType: PlantingEventType | null,
): Planting {
  if (planting.id !== task.plantingId) {
    return planting;
  }

  if (
    task.type === 'plant' ||
    task.type === 'sow' ||
    task.type === 'transplant'
  ) {
    const nextPlanting = eventType
      ? appendPlantingEvent(planting, {
          nowIso: completedAtIso,
          occurredOn: completedDate,
          type: eventType,
        })
      : planting;
    const nextStatus =
      planting.status === 'planned' ? 'growing' : nextPlanting.status;

    return {
      ...nextPlanting,
      plantedOn: nextPlanting.plantedOn ?? completedDate,
      plantStatus: {
        ...nextPlanting.plantStatus,
        lifecycle: nextStatus,
      },
      status: nextStatus,
    };
  }

  if (task.type === 'thin') {
    return appendPlantingEvent(planting, {
      nowIso: completedAtIso,
      occurredOn: completedDate,
      type: 'thinned',
    });
  }

  if (task.type === 'harvest') {
    return {
      ...planting,
      plantStatus: {
        ...planting.plantStatus,
        lifecycle: 'harvested',
      },
      status: 'harvested',
    };
  }

  if (task.type === 'mulch') {
    return {
      ...planting,
      mulched: true,
    };
  }

  return planting;
}

export function getPlantingEventTypeForCompletedTask(
  task: Task,
): PlantingEventType | null {
  if (task.type === 'plant' || task.type === 'transplant') {
    return 'plantedOut';
  }

  if (task.type === 'sow') {
    return task.id.endsWith('-seed-start') ? 'startedInside' : 'directSowed';
  }

  if (task.type === 'thin') {
    return 'thinned';
  }

  return null;
}
