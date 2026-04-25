import type {
  IsoDateString,
  JournalEntry,
  LocalDateString,
  Planting,
  PlantingEvent,
  PlantingEventType,
} from './models';

export function buildPlantingEventId(
  type: PlantingEventType,
  occurredOn: LocalDateString,
) {
  return `planting-event:${type}:${occurredOn}`;
}

export function createPlantingEvent(input: {
  id?: string;
  occurredOn: LocalDateString;
  type: PlantingEventType;
}): PlantingEvent {
  return {
    id: input.id ?? buildPlantingEventId(input.type, input.occurredOn),
    occurredOn: input.occurredOn,
    type: input.type,
  };
}

export function sortPlantingEvents(events: PlantingEvent[]) {
  return [...events].sort(
    (left, right) =>
      right.occurredOn.localeCompare(left.occurredOn) ||
      left.type.localeCompare(right.type),
  );
}

export function getLatestPlantingEvent(
  planting: Pick<Planting, 'plantingEvents'>,
  type: PlantingEventType,
) {
  const matching = planting.plantingEvents.filter(
    (event) => event.type === type,
  );

  if (matching.length === 0) {
    return null;
  }

  return sortPlantingEvents(matching)[0] ?? null;
}

export function getLatestPlantingEventDate(
  planting: Pick<Planting, 'plantingEvents'>,
  type: PlantingEventType,
) {
  return getLatestPlantingEvent(planting, type)?.occurredOn ?? null;
}

export function getNewPlantingEvents(
  previousPlanting: Pick<Planting, 'plantingEvents'>,
  nextPlanting: Pick<Planting, 'plantingEvents'>,
) {
  const previousIds = new Set(
    previousPlanting.plantingEvents.map((event) => event.id),
  );

  return sortPlantingEvents(
    nextPlanting.plantingEvents.filter((event) => !previousIds.has(event.id)),
  );
}

export function appendPlantingEvent(
  planting: Planting,
  input: {
    nowIso?: IsoDateString | null;
    occurredOn: LocalDateString;
    type: PlantingEventType;
  },
): Planting {
  const nextEvent = createPlantingEvent({
    occurredOn: input.occurredOn,
    type: input.type,
  });
  const withoutDuplicate = planting.plantingEvents.filter(
    (event) => event.id !== nextEvent.id,
  );
  const plantingEvents = sortPlantingEvents([...withoutDuplicate, nextEvent]);

  if (input.type === 'directSowed' || input.type === 'plantedOut') {
    return {
      ...planting,
      plannedFor: null,
      plantedOn: input.occurredOn,
      plantingEvents,
      plantStatus: {
        ...planting.plantStatus,
        lifecycle: 'planted',
      },
      status:
        planting.status === 'removed' || planting.status === 'harvested'
          ? planting.status
          : 'planted',
    };
  }

  if (input.type === 'thinned') {
    return {
      ...planting,
      plantingEvents,
      plantStatus: {
        ...planting.plantStatus,
        thinned: true,
        thinnedAtIso: input.nowIso ?? planting.plantStatus.thinnedAtIso ?? null,
      },
    };
  }

  return {
    ...planting,
    plantingEvents,
  };
}

export function getInGroundDate(planting: Planting) {
  return (
    getLatestPlantingEventDate(planting, 'plantedOut') ??
    getLatestPlantingEventDate(planting, 'directSowed') ??
    planting.plantedOn
  );
}

export function formatPlantingEventLabel(type: PlantingEventType) {
  const labels: Record<PlantingEventType, string> = {
    directSowed: 'Direct sowed',
    plantedOut: 'Planted out',
    startedInside: 'Started indoors',
    thinned: 'Thinned',
  };

  return labels[type];
}

export function createPlantingEventJournalCopy(
  plantingLabel: string,
  type: PlantingEventType,
  occurredOn: LocalDateString,
) {
  const label = formatPlantingEventLabel(type);
  const lowerLabel = label.charAt(0).toLowerCase() + label.slice(1);

  return {
    body: `${plantingLabel} was ${lowerLabel} on ${occurredOn}.`,
    title: `${label} ${plantingLabel}`,
  };
}

export function createPlantingEventJournalEntry(input: {
  createdAtIso: IsoDateString;
  event: PlantingEvent;
  gardenId: string;
  plantingId: string;
  plantingLabel: string;
  weatherSnapshotId?: string | null;
}): JournalEntry {
  const copy = createPlantingEventJournalCopy(
    input.plantingLabel,
    input.event.type,
    input.event.occurredOn,
  );

  return {
    body: copy.body,
    createdAtIso: input.createdAtIso,
    gardenId: input.gardenId,
    id: `planting-event-note:${input.plantingId}:${input.event.id}`,
    issueCategory: null,
    issueSeverity: null,
    issueStatus: null,
    occurredOn: input.event.occurredOn,
    photos: [],
    plantingId: input.plantingId,
    structureId: null,
    targetLabel: input.plantingLabel,
    targetType: 'planting',
    title: copy.title,
    type: 'note',
    weatherSnapshotId: input.weatherSnapshotId ?? null,
  };
}
