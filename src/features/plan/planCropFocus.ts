import { getCropById } from '../../domain/crops/cropCatalog';
import type {
  Garden,
  Planting,
  PlantingInstance,
  PlantingLifecycleStatus,
  SunShadeLayer,
  Task,
} from '../../domain/gardens/GardenRepository';
import { getPlantingInstances } from '../../domain/gardens/plantingInstances';
import { formatFeet } from '../garden/gardenMath';
import {
  getPlanWarningDecisionCategory,
  getPlanWarningDecisionCategoryMeta,
  type PlanWarning,
} from '../garden/gardenPlanning';
import { getCropSupportNeed } from '../garden/gardenStructureRules';
import { getSunAreaAtPoint } from '../garden/sunShadeEngine';
import { describeCropSunFit } from '../garden/sunShadeFit';
import type { SelectedGardenItem } from '../garden/useGarden';

export type CropFocusView = 'crop' | 'needs' | 'selected';

export interface CropFocusSummary {
  crop: {
    lifecycleSummary: string;
    name: string;
    nodeCount: number;
    plantingCount: number;
  };
  cropId: string | null;
  focusKey: string;
  needs: {
    sun: string | null;
    support: string | null;
    tasks: string[];
    warnings: string[];
  };
  selected: {
    label: string;
    plantingLabel: string;
    position: string;
    status: string;
  };
  selectionKey: string;
}

export function buildCropFocusSummary({
  garden,
  selectedItem,
  sunLayer,
  warnings,
}: {
  garden: Garden;
  selectedItem: SelectedGardenItem | null;
  sunLayer: SunShadeLayer;
  warnings: PlanWarning[];
}): CropFocusSummary | null {
  if (selectedItem?.type !== 'planting') {
    return null;
  }

  const selectedPlanting =
    garden.plantings.find((planting) => planting.id === selectedItem.id) ??
    null;

  if (!selectedPlanting) {
    return null;
  }

  const selectedInstance = getSelectedInstance(
    selectedPlanting,
    selectedItem.instanceId,
  );
  const focusKey = getPlantingFocusKey(selectedPlanting);
  const crop = selectedPlanting.cropId
    ? getCropById(selectedPlanting.cropId)
    : null;
  const matchingPlantings = garden.plantings.filter(
    (planting) => getPlantingFocusKey(planting) === focusKey,
  );
  const matchingPlantingIds = new Set(
    matchingPlantings.map((planting) => planting.id),
  );
  const matchingWarnings = warnings.filter((warning) =>
    warning.itemIds.some((itemId) => matchingPlantingIds.has(itemId)),
  );
  const matchingTasks = garden.tasks.filter(
    (task) =>
      task.status === 'open' &&
      task.plantingId !== null &&
      matchingPlantingIds.has(task.plantingId),
  );
  const nodeCount = matchingPlantings.reduce(
    (total, planting) => total + getPlantingInstances(planting).length,
    0,
  );

  return {
    crop: {
      lifecycleSummary: formatLifecycleSummary(matchingPlantings),
      name: crop?.commonName ?? selectedPlanting.label,
      nodeCount,
      plantingCount: matchingPlantings.length,
    },
    cropId: selectedPlanting.cropId,
    focusKey,
    needs: {
      sun: formatSunNeed(selectedPlanting, sunLayer),
      support: formatSupportNeed(crop),
      tasks: formatTaskSummaries(matchingTasks),
      warnings: formatWarningSummaries(matchingWarnings),
    },
    selected: {
      label: selectedInstance.label || selectedPlanting.label,
      plantingLabel: selectedPlanting.label,
      position: `X ${formatFeet(selectedInstance.xFt)} ft, Y ${formatFeet(
        selectedInstance.yFt,
      )} ft`,
      status: formatLifecycle(selectedPlanting.status),
    },
    selectionKey: selectedItem.instanceId
      ? `${selectedItem.id}:${selectedItem.instanceId}`
      : selectedItem.id,
  };
}

export function getPlantingFocusKey(planting: Planting) {
  return planting.cropId ?? `custom:${planting.label.trim().toLowerCase()}`;
}

function getSelectedInstance(
  planting: Planting,
  instanceId: string | undefined,
): PlantingInstance {
  const instances = getPlantingInstances(planting);

  return (
    instances.find((instance) => instance.id === instanceId) ??
    instances[0] ?? {
      id: `${planting.id}-plant-1`,
      label: planting.label,
      xFt: planting.xFt,
      yFt: planting.yFt,
    }
  );
}

function formatWarningSummaries(warnings: PlanWarning[]) {
  const priorityKinds = new Set(['spacing', 'trellis', 'sun', 'structure']);
  const grouped = new Map<
    ReturnType<typeof getPlanWarningDecisionCategory>,
    PlanWarning[]
  >();

  for (const warning of warnings) {
    if (!priorityKinds.has(warning.kind)) {
      continue;
    }

    const category = getPlanWarningDecisionCategory(warning);
    grouped.set(category, [...(grouped.get(category) ?? []), warning]);
  }

  return [...grouped.entries()].slice(0, 3).map(([category, groupWarnings]) => {
    const meta = getPlanWarningDecisionCategoryMeta(category);
    const firstWarning = groupWarnings[0];
    const extraCount = groupWarnings.length - 1;

    return `${meta.label}: ${firstWarning?.message ?? meta.prompt}${
      extraCount > 0 ? ` (${extraCount} more)` : ''
    }`;
  });
}

function formatTaskSummaries(tasks: Task[]) {
  return [...tasks]
    .sort((left, right) =>
      (left.dueDate ?? '9999-12-31').localeCompare(
        right.dueDate ?? '9999-12-31',
      ),
    )
    .slice(0, 3)
    .map((task) =>
      task.dueDate ? `${task.title} (${task.dueDate})` : task.title,
    );
}

function formatSupportNeed(crop: ReturnType<typeof getCropById>) {
  if (!crop) {
    return null;
  }

  const support = getCropSupportNeed(crop);

  if (!support) {
    return null;
  }

  return `${formatLabel(support.kind)} ${
    support.required ? 'required' : 'recommended'
  }. ${support.reason}`;
}

function formatSunNeed(planting: Planting, sunLayer: SunShadeLayer) {
  if (!planting.sunRequirement) {
    return null;
  }

  const sunArea = getSunAreaAtPoint(sunLayer, planting);

  if (!sunArea) {
    return null;
  }

  const fit = describeCropSunFit(planting.sunRequirement, sunArea);

  if (fit.level === 'good') {
    return null;
  }

  return `${fit.label}: ${fit.message}`;
}

function formatLifecycleSummary(plantings: Planting[]) {
  const counts = new Map<PlantingLifecycleStatus, number>();

  for (const planting of plantings) {
    const count = counts.get(planting.status) ?? 0;
    counts.set(planting.status, count + getPlantingInstances(planting).length);
  }

  return [...counts.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([status, count]) => `${count} ${formatLifecycle(status)}`)
    .join(', ');
}

function formatLifecycle(status: PlantingLifecycleStatus) {
  const labels: Record<PlantingLifecycleStatus, string> = {
    growing: 'growing',
    'harvest-ready': 'harvest-ready',
    harvested: 'harvested',
    planned: 'planned',
    planted: 'planted',
    removed: 'removed',
  };

  return labels[status];
}

function formatLabel(value: string) {
  return value
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (letter) => letter.toUpperCase());
}
