import {
  createPlantingEventJournalEntry,
  getNewPlantingEvents,
  type Garden,
  type JournalEntry,
  type Planting,
} from '../../domain/gardens/GardenRepository';
import { synchronizeGardenTasks } from '../tasks/taskEngine';

export function applyPlantingEventEffects(input: {
  garden: Garden;
  nextPlantings: Planting[];
  now: Date;
}) {
  const { garden, nextPlantings, now } = input;
  const existingJournalIds = new Set(
    garden.journalEntries.map((entry) => entry.id),
  );
  const previousPlantingsById = new Map(
    garden.plantings.map((planting) => [planting.id, planting] as const),
  );
  const eventEntries: JournalEntry[] = [];

  for (const nextPlanting of nextPlantings) {
    const previousPlanting = previousPlantingsById.get(nextPlanting.id);

    if (!previousPlanting) {
      continue;
    }

    const newEvents = getNewPlantingEvents(previousPlanting, nextPlanting);

    for (const event of newEvents) {
      const entry = createPlantingEventJournalEntry({
        createdAtIso: now.toISOString(),
        event,
        gardenId: garden.id,
        plantingId: nextPlanting.id,
        plantingLabel: nextPlanting.label,
      });

      if (!existingJournalIds.has(entry.id)) {
        existingJournalIds.add(entry.id);
        eventEntries.push(entry);
      }
    }
  }

  return synchronizeGardenTasks(
    {
      ...garden,
      journalEntries: [...eventEntries, ...garden.journalEntries],
      plantings: nextPlantings,
      updatedAtIso: now.toISOString(),
    },
    {
      now,
      refreshOpenGenerated: true,
    },
  );
}
