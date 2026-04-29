import { getCropById } from '../../domain/crops/cropCatalog';
import type {
  Garden,
  LocalDateString,
  Planting,
  Structure,
} from '../../domain/gardens/GardenRepository';
import {
  getStructureFootprint,
  isRectInsideStructure,
  rectsOverlap,
  type FootRect,
} from './gardenPlanningGeometry';
import { buildRotationGuidance } from './gardenRotation';
import type { PlanWarning, PlanWarningContext } from './gardenPlanning';
import { cropSunRequirementMet, getSunAreaAtPoint } from './sunShadeEngine';
import { describeCropSunFit, describeShadeSourceSummary } from './sunShadeFit';
import {
  getCropSupportNeed,
  getPathRequiredWidthFt,
  getSupportLabel,
  getWalkablePathWidthFt,
  hasNearbySupport,
  hasPlantLevelSupport,
  hasWalkablePathAccess,
  isBedLikeStructure,
  isBlockingStructure,
  isMeaningfulAccessPath,
  isPathStructure,
} from './gardenStructureRules';

const dayMs = 24 * 60 * 60 * 1000;

type PlantingFootprint = { footprint: FootRect; planting: Planting };

export function addSpacingWarnings(
  plantings: PlantingFootprint[],
  warnings: PlanWarning[],
  now: Date,
) {
  const conflicts = new Map<string, Set<string>>();
  const plantingById = new Map(
    plantings.map((entry) => [entry.planting.id, entry]),
  );

  for (let leftIndex = 0; leftIndex < plantings.length; leftIndex += 1) {
    for (
      let rightIndex = leftIndex + 1;
      rightIndex < plantings.length;
      rightIndex += 1
    ) {
      const left = plantings[leftIndex];
      const right = plantings[rightIndex];

      if (!left || !right) {
        continue;
      }

      if (
        rectsOverlap(left.footprint, right.footprint) &&
        occupancyWindowsOverlap(left.planting, right.planting, now)
      ) {
        addConflict(conflicts, left.planting.id, right.planting.id);
      }
    }
  }

  for (const component of connectedComponents(conflicts)) {
    const entries = component.flatMap((id) => {
      const entry = plantingById.get(id);

      return entry ? [entry] : [];
    });

    if (entries.length < 2) {
      continue;
    }

    const sortedEntries = entries.sort((left, right) =>
      left.planting.label.localeCompare(right.planting.label),
    );
    const labels = sortedEntries.map((entry) => entry.planting.label);
    const ids = sortedEntries.map((entry) => entry.planting.id);
    warnings.push(
      createWarning({
        fix: 'Add planting dates, reduce a footprint, or move one crop before treating this as a real conflict.',
        id: `spacing-${ids.sort().join('-')}`,
        itemIds: ids,
        kind: 'spacing',
        message:
          labels.length === 2
            ? `${labels[0]} and ${labels[1]} need the same mature space at the same time.`
            : `${labels[0]}, ${labels[1]}, and ${labels.length - 2} more plantings need the same mature space at the same time.`,
        severity: 'warning',
        title: 'Spacing collision',
      }),
    );
  }
}

export function addStructureWarnings(
  garden: Garden,
  plantings: PlantingFootprint[],
  warnings: PlanWarning[],
) {
  const beds = garden.structures.filter(isBedLikeStructure);

  for (const { footprint } of plantings) {
    for (const structure of garden.structures) {
      if (!isBlockingStructure(structure)) {
        continue;
      }

      const structureFootprint = getStructureFootprint(structure);

      if (!rectsOverlap(footprint, structureFootprint)) {
        continue;
      }

      const pathway = structure.type === 'path' || structure.type === 'pathway';
      const primaryPath = pathway && isMeaningfulAccessPath(structure, beds);
      warnings.push(
        createWarning({
          fix: pathway
            ? 'Keep walkways clear enough to reach the bed without stepping on crops.'
            : 'Move the crop or structure so their saved footprints do not overlap.',
          id: `${pathway ? 'pathway' : 'structure'}-${footprint.id}-${structure.id}`,
          itemIds: [footprint.id, structure.id],
          kind: pathway ? 'pathway' : 'structure',
          message: pathway
            ? `${footprint.label} sits in ${structure.label}. Keep the ${primaryPath ? 'primary access route' : 'walking route'} clear.`
            : `${footprint.label} overlaps ${structure.label}. Separate the saved footprints.`,
          severity: primaryPath ? 'critical' : pathway ? 'warning' : 'critical',
          title: primaryPath
            ? 'Primary path blocked'
            : pathway
              ? 'Pathway conflict'
              : 'Structure conflict',
        }),
      );
    }
  }

  addPathPlanningWarnings(garden, warnings);
}

export function addBedFitWarnings(
  garden: Garden,
  plantings: PlantingFootprint[],
  warnings: PlanWarning[],
) {
  const beds = garden.structures.filter(isBedLikeStructure);

  for (const { footprint, planting } of plantings) {
    const bed = findContainingStructure(beds, planting);
    const crop = getCropById(planting.cropId);

    if (!bed && beds.length > 0) {
      warnings.push(
        createWarning({
          acknowledgeable: true,
          fix: 'Move it into a saved bed/container or leave it if open-ground planting is intentional.',
          id: `bedfit-open-${planting.id}`,
          itemIds: [planting.id],
          kind: 'bedFit',
          message: `${planting.label} is outside saved beds and containers. This is fine if you plant directly in open ground.`,
          severity: 'info',
          title: 'Open-ground placement',
        }),
      );
      continue;
    }

    if (bed && !isRectInsideStructure(footprint, bed)) {
      warnings.push(
        createWarning({
          fix: `Move ${planting.label} inward or resize ${bed.label} so the full mature footprint fits.`,
          id: `bedfit-${planting.id}-${bed.id}`,
          itemIds: [planting.id, bed.id],
          kind: 'bedFit',
          message: `${planting.label} needs more room than ${bed.label} currently gives it.`,
          severity: 'warning',
          title: 'Bed fit issue',
        }),
      );
    }

    if (
      bed?.type === 'container' &&
      crop &&
      isContainerMismatch(crop, planting, bed)
    ) {
      warnings.push(
        createWarning({
          acknowledgeable: true,
          fix: 'Use a larger container, reduce the planting, or confirm this cultivar/container is intentional.',
          id: `container-${planting.id}-${bed.id}`,
          itemIds: [planting.id, bed.id],
          kind: 'container',
          message: `${planting.label} may outgrow ${bed.label}; this is based on general crop size data.`,
          severity: 'info',
          title: 'Container caution',
        }),
      );
    }
  }
}

export function addSunWarnings(
  context: PlanWarningContext,
  plantings: PlantingFootprint[],
  warnings: PlanWarning[],
) {
  if (!context.sunLayer) {
    return;
  }

  for (const { planting } of plantings) {
    const sunArea = getSunAreaAtPoint(context.sunLayer, planting);

    if (
      planting.sunRequirement &&
      sunArea &&
      !cropSunRequirementMet(planting.sunRequirement, sunArea.exposure)
    ) {
      const isManualSun = sunArea.source === 'manual';
      const sunFit = describeCropSunFit(planting.sunRequirement, sunArea);
      const shadeSource = describeShadeSourceSummary(sunArea.shadeSources);

      warnings.push(
        createWarning({
          fix: sunFit.action,
          id: `sun-${context.sunSeason ?? context.sunLayer.season}-${planting.id}`,
          itemIds: [planting.id],
          kind: 'sun',
          message: `${planting.label} prefers ${formatSun(planting.sunRequirement)}. This ${context.sunSeason ?? context.sunLayer.season} ${isManualSun ? 'manual observation is' : 'model is'} ${formatSun(sunArea.exposure)} (${sunArea.sunHours.toFixed(1)} direct-sun hours)${shadeSource ? ` with ${shadeSource}` : ''}.`,
          severity: isManualSun ? 'warning' : 'info',
          title: 'Sun mismatch',
          uncertainty: isManualSun ? 'observed' : 'modeled',
        }),
      );
    }
  }
}

export function addTrellisWarnings(
  garden: Garden,
  plantings: PlantingFootprint[],
  warnings: PlanWarning[],
) {
  for (const { planting } of plantings) {
    const crop = getCropById(planting.cropId);
    const supportNeed = crop ? getCropSupportNeed(crop) : null;

    if (!supportNeed) {
      continue;
    }

    if (
      supportNeed.kind === 'trellis'
        ? hasNearbySupport(garden, planting)
        : hasPlantLevelSupport(planting, supportNeed.kind)
    ) {
      continue;
    }

    const supportLabel = getSupportLabel(supportNeed.kind);
    warnings.push(
      createWarning({
        acknowledgeable: !supportNeed.required,
        fix:
          supportNeed.kind === 'trellis'
            ? `Add or link a saved grid trellis next to ${planting.label}. Trellis-line layout controls plant arrangement, not whether a real trellis exists.`
            : `Assign ${planting.label} a plant-level ${supportLabel}; this should live on the plant group, not as a standalone structure.`,
        id: `trellis-${planting.id}`,
        itemIds: [planting.id],
        kind: 'trellis',
        message:
          supportNeed.kind === 'trellis'
            ? `${planting.label} needs a saved grid trellis, but no nearby trellis structure is on the plot. ${supportNeed.reason}`
            : `${planting.label} needs a plant-level ${supportLabel}, but the plant group has no ${supportLabel} assigned. ${supportNeed.reason}`,
        severity: supportNeed.required ? 'warning' : 'info',
        title:
          supportNeed.kind === 'trellis'
            ? 'Trellis missing'
            : `${capitalize(supportLabel)} missing`,
      }),
    );
  }
}

export function addRotationWarnings(
  garden: Garden,
  warnings: PlanWarning[],
  now: Date,
) {
  for (const guidance of buildRotationGuidance(garden, now)) {
    if (guidance.level === 'safe' || guidance.level === 'unknown') {
      continue;
    }

    warnings.push(
      createWarning({
        acknowledgeable: guidance.level === 'caution',
        fix:
          guidance.level === 'avoid'
            ? 'Choose a different family for this bed or move the crop to another bed if possible.'
            : 'Treat this as a caution from saved history; rotate if disease pressure was a problem.',
        id: `rotation-${guidance.level}-${guidance.plantingId}`,
        itemIds: [guidance.plantingId],
        kind: 'rotation',
        message: guidance.message,
        severity: guidance.level === 'avoid' ? 'warning' : 'info',
        title:
          guidance.level === 'avoid' ? 'Rotation avoid' : 'Rotation caution',
      }),
    );
  }
}

function createWarning(
  warning: Omit<PlanWarning, 'acknowledgeable'> &
    Partial<
      Pick<
        PlanWarning,
        | 'acknowledgeable'
        | 'groupKey'
        | 'taxonomy'
        | 'uncertainty'
        | 'visibility'
      >
    >,
): PlanWarning {
  return {
    acknowledgeable: warning.acknowledgeable ?? warning.severity === 'info',
    ...warning,
  };
}

function occupancyWindowsOverlap(left: Planting, right: Planting, now: Date) {
  const leftWindow = getOccupancyWindow(left, now);
  const rightWindow = getOccupancyWindow(right, now);

  return (
    leftWindow.start < rightWindow.end && rightWindow.start < leftWindow.end
  );
}

function getOccupancyWindow(planting: Planting, now: Date) {
  const crop = getCropById(planting.cropId);
  const start = planting.plantedOn ?? planting.plannedFor ?? toLocalDate(now);
  const days = crop?.daysToMaturity ?? 75;
  const bufferDays = planting.plantedOn || planting.plannedFor ? 7 : 14;

  return {
    end:
      planting.status === 'harvested'
        ? start
        : addDays(start, days + bufferDays),
    start,
  };
}

function addConflict(
  conflicts: Map<string, Set<string>>,
  leftId: string,
  rightId: string,
) {
  conflicts.set(leftId, new Set([...(conflicts.get(leftId) ?? []), rightId]));
  conflicts.set(rightId, new Set([...(conflicts.get(rightId) ?? []), leftId]));
}

function connectedComponents(conflicts: Map<string, Set<string>>) {
  const seen = new Set<string>();
  const components: string[][] = [];

  for (const id of conflicts.keys()) {
    if (seen.has(id)) {
      continue;
    }

    const stack = [id];
    const component: string[] = [];
    seen.add(id);

    while (stack.length > 0) {
      const nextId = stack.pop();

      if (!nextId) {
        continue;
      }

      component.push(nextId);

      for (const neighborId of conflicts.get(nextId) ?? []) {
        if (!seen.has(neighborId)) {
          seen.add(neighborId);
          stack.push(neighborId);
        }
      }
    }

    components.push(component);
  }

  return components;
}

function findContainingStructure(structures: Structure[], planting: Planting) {
  return structures.find((structure) => containsPoint(structure, planting));
}

function isContainerMismatch(
  crop: NonNullable<ReturnType<typeof getCropById>>,
  planting: Planting,
  container: Structure,
) {
  const maxContainerSide = Math.max(container.widthFt, container.depthFt);
  const spreadFt =
    (crop.matureSpreadInches ?? planting.spacingInches ?? 12) / 12;

  return (
    spreadFt > maxContainerSide ||
    crop.growthForm === 'vining' ||
    crop.growthForm === 'climber' ||
    crop.trellisRequired
  );
}

function addPathPlanningWarnings(garden: Garden, warnings: PlanWarning[]) {
  const paths = garden.structures.filter(isPathStructure);
  const beds = garden.structures.filter(isBedLikeStructure);
  const accessPaths = paths.filter((path) =>
    isMeaningfulAccessPath(path, beds),
  );

  for (const path of accessPaths) {
    const requiredWidthFt = getPathRequiredWidthFt(path);
    const walkableWidthFt = getWalkablePathWidthFt(path);

    if (walkableWidthFt < requiredWidthFt) {
      warnings.push(
        createWarning({
          fix: `Resize the narrow side of ${path.label} to at least ${requiredWidthFt} ft for the saved path standard.`,
          id: `path-width-${path.id}`,
          itemIds: [path.id],
          kind: 'pathway',
          message: `${path.label} has ${walkableWidthFt.toFixed(1)} ft of walkable width. Make the narrow side ${requiredWidthFt} ft for the saved ${path.accessiblePath ? 'accessible' : 'standard'} path setting.`,
          severity: 'warning',
          title: 'Path too narrow',
        }),
      );
    }

    if (!path.continuousPath) {
      warnings.push(
        createWarning({
          acknowledgeable: true,
          fix: 'Extend this path, add connecting path segments, or mark it continuous once it reaches the beds it serves.',
          id: `path-continuity-${path.id}`,
          itemIds: [path.id],
          kind: 'pathway',
          message: `${path.label} is not marked as a continuous route. This only matters if it is meant to be the main access path.`,
          severity: 'info',
          title: 'Path continuity check',
        }),
      );
    }
  }

  if (beds.length > 0 && paths.length === 0) {
    warnings.push(
      createWarning({
        acknowledgeable: true,
        fix: 'Add at least one path object so watering, harvesting, and maintenance have a saved access route.',
        id: 'pathway-missing-access',
        itemIds: beds.map((bed) => bed.id),
        kind: 'pathway',
        message:
          'Beds are saved without a path or working aisle. Add one if access is not already obvious in the real garden.',
        severity: 'info',
        title: 'Access path missing',
      }),
    );
    return;
  }

  for (const bed of beds) {
    const clearanceFt = bed.workingClearanceFt ?? 2;

    if (clearanceFt <= 0) {
      continue;
    }

    const hasWorkingAccess = hasWalkablePathAccess(
      bed,
      accessPaths,
      clearanceFt,
    );

    if (!hasWorkingAccess) {
      warnings.push(
        createWarning({
          acknowledgeable: true,
          fix: `Add or move a path within ${clearanceFt} ft of ${bed.label}, or reduce its working clearance if this is intentional.`,
          id: `path-clearance-${bed.id}`,
          itemIds: [bed.id],
          kind: 'pathway',
          message: `${bed.label} has no saved path within ${clearanceFt} ft. Add an access route if this bed is hard to reach.`,
          severity: 'info',
          title: 'Working clearance missing',
        }),
      );
    }
  }
}

function containsPoint(structure: Structure, planting: Planting) {
  return (
    planting.xFt >= structure.xFt &&
    planting.xFt <= structure.xFt + structure.widthFt &&
    planting.yFt >= structure.yFt &&
    planting.yFt <= structure.yFt + structure.depthFt
  );
}

function formatSun(value: string) {
  return value.replace(/([A-Z])/g, ' $1').toLowerCase();
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function addDays(date: LocalDateString, days: number): LocalDateString {
  return toLocalDate(new Date(parseLocalDate(date).getTime() + days * dayMs));
}

function parseLocalDate(date: LocalDateString) {
  const [year = '1970', month = '1', day = '1'] = date.split('-');

  return new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
}

function toLocalDate(date: Date): LocalDateString {
  return date.toISOString().slice(0, 10);
}
