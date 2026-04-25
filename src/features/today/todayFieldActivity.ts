import { getCropById } from '../../domain/crops/cropCatalog';
import { getLatestPlantingEventDate } from '../../domain/gardens/GardenRepository';
import type {
  Garden,
  HarvestEvent,
  Planting,
  PlantingLifecycleStatus,
} from '../../domain/gardens/GardenRepository';
import { getBedLabelForPlanting } from './todayGardenLabels';

export interface TodayCropStageAction {
  bedLabel: string;
  cropName: string;
  nextStatus: PlantingLifecycleStatus;
  planting: Planting;
  summary: string;
}

export interface TodayRecentActivity {
  id: string;
  meta: string;
  title: string;
  tone: 'neutral' | 'success' | 'warning';
}

export function getCropStageActions(
  garden: Garden,
  todayDate: string,
): TodayCropStageAction[] {
  return garden.plantings
    .flatMap((planting): TodayCropStageAction[] => {
      const nextStatus = getNextFieldStatus(planting.status);

      if (!nextStatus || !isStageRelevantToday(planting, todayDate)) {
        return [];
      }

      return [
        {
          bedLabel: getBedLabelForPlanting(garden, planting),
          cropName: getCropById(planting.cropId)?.commonName ?? planting.label,
          nextStatus,
          planting,
          summary: getStageSummary(planting, nextStatus),
        },
      ];
    })
    .sort(
      (left, right) =>
        getPlantingSortDate(left.planting).localeCompare(
          getPlantingSortDate(right.planting),
        ) || left.planting.label.localeCompare(right.planting.label),
    )
    .slice(0, 6);
}

export function getRecentActivity(garden: Garden): TodayRecentActivity[] {
  const journalActivity = garden.journalEntries.map((entry) => ({
    id: `journal-${entry.id}`,
    meta: `${entry.targetLabel} - ${entry.occurredOn}`,
    sortKey: entry.createdAtIso,
    title: entry.type === 'issue' ? `Issue: ${entry.title}` : entry.title,
    tone:
      entry.type === 'issue' && entry.issueStatus !== 'resolved'
        ? ('warning' as const)
        : ('neutral' as const),
  }));
  const harvestActivity = garden.harvestEvents.map((harvest) => ({
    id: `harvest-${harvest.id}`,
    meta: `${getHarvestLabel(garden, harvest)} - ${harvest.harvestedOn}`,
    sortKey: `${harvest.harvestedOn}T23:59:59.000Z`,
    title: `Harvest logged: ${harvest.amountText}`,
    tone: 'success' as const,
  }));
  const completedTaskActivity = garden.tasks
    .filter((task) => task.status === 'done' && task.completedAtIso)
    .map((task) => ({
      id: `task-${task.id}`,
      meta: `${task.bedLabel ?? 'Open plot'} - ${task.type}`,
      sortKey: task.completedAtIso ?? '',
      title: `Task done: ${task.title}`,
      tone: 'success' as const,
    }));

  return [...journalActivity, ...harvestActivity, ...completedTaskActivity]
    .sort((left, right) => right.sortKey.localeCompare(left.sortKey))
    .slice(0, 6)
    .map(({ id, meta, title, tone }) => ({ id, meta, title, tone }));
}

function getNextFieldStatus(status: PlantingLifecycleStatus) {
  const next: Partial<
    Record<PlantingLifecycleStatus, PlantingLifecycleStatus>
  > = {
    planned: 'planted',
    planted: 'growing',
  };

  return next[status] ?? null;
}

function isStageRelevantToday(planting: Planting, todayDate: string) {
  return (
    planting.status !== 'planned' ||
    !planting.plannedFor ||
    planting.plannedFor <= todayDate
  );
}

function getStageSummary(
  planting: Planting,
  nextStatus: PlantingLifecycleStatus,
) {
  const startedInsideDate = getLatestPlantingEventDate(
    planting,
    'startedInside',
  );
  const directSowedDate = getLatestPlantingEventDate(planting, 'directSowed');
  const plantedOutDate = getLatestPlantingEventDate(planting, 'plantedOut');

  if (nextStatus === 'planted') {
    if (startedInsideDate) {
      return `Started indoors ${startedInsideDate}. Plant out once it is ready for the bed.`;
    }

    return planting.plannedFor
      ? `Planned for ${planting.plannedFor}`
      : 'Ready when planted in the field';
  }

  if (nextStatus === 'growing') {
    if (directSowedDate) {
      return `Direct sowed ${directSowedDate}`;
    }

    if (plantedOutDate ?? planting.plantedOn) {
      return `Planted out ${plantedOutDate ?? planting.plantedOn}`;
    }

    return planting.plantedOn
      ? `Planted ${planting.plantedOn}`
      : 'Confirm it has taken off';
  }

  return 'Update crop status';
}

function getPlantingSortDate(planting: Planting) {
  return planting.plannedFor ?? planting.plantedOn ?? '9999-12-31';
}

function getHarvestLabel(garden: Garden, harvest: HarvestEvent) {
  const planting = garden.plantings.find(
    (candidate) => candidate.id === harvest.plantingId,
  );

  return (
    planting?.label ??
    getCropById(harvest.cropId)?.commonName ??
    harvest.cropId ??
    'Whole garden'
  );
}
