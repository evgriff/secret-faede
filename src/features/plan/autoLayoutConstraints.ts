import { getCropById } from '../../domain/crops/cropCatalog';
import type {
  CropProfile,
  Garden,
  Planting,
} from '../../domain/gardens/GardenRepository';
import {
  getPlantingFootprint,
  getStructureFootprint,
  rectsOverlap,
  type FootRect,
} from '../garden/gardenPlanning';
import {
  doesPlantingReserveSpace,
  isPlantingAnchoredForOptimizer,
} from '../garden/gardenImmutability';
import { isRectInsidePlot } from '../garden/gardenPlanningGeometry';
import {
  cropNeedsSupport as cropNeedsSavedSupport,
  type CropSupportKind,
  getCropSupportNeed,
  hasNearbySupportFootprint,
  isBlockingStructure as isBlockingSavedStructure,
} from '../garden/gardenStructureRules';
import { autoLayoutProposalMarker } from './autoLayoutPlanner';

const dayMs = 24 * 60 * 60 * 1000;

export interface SupportFootprint {
  depthFt: number;
  heightFt: number;
  widthFt: number;
  xFt: number;
  yFt: number;
}

export function getLayoutReferenceDate(garden: Garden) {
  const timestamp = garden.seasonPlan.updatedAtIso;
  const date = timestamp ? new Date(timestamp) : new Date();

  return Number.isNaN(date.getTime()) ? new Date() : date;
}

export function buildReservedRects(
  garden: Garden,
  proposedPlanting: Planting | null,
  referenceDate: Date,
) {
  const blockedStructures = garden.structures
    .filter(isBlockingStructure)
    .map(getStructureFootprint);
  const reservedPlantings = garden.plantings
    .filter((planting) =>
      shouldReservePlanting(planting, proposedPlanting, referenceDate),
    )
    .map(getPlantingFootprint);

  return [...blockedStructures, ...reservedPlantings];
}

export function cropNeedsSupport(crop: CropProfile) {
  return cropNeedsSavedSupport(crop);
}

export function canSupportFootprint(
  garden: Garden,
  crop: CropProfile,
  footprint: FootRect,
  blockedRects: FootRect[] = [],
) {
  if (!cropNeedsSupport(crop)) {
    return true;
  }

  return (
    hasExistingSupport(garden, footprint) ||
    Boolean(
      getLegalSupportFootprint(
        garden,
        crop,
        footprint,
        undefined,
        blockedRects,
      ),
    )
  );
}

export function getLegalSupportFootprint(
  garden: Garden,
  crop: CropProfile,
  cropFootprint: FootRect,
  supportKind?: CropSupportKind,
  blockedRects: FootRect[] = [],
): SupportFootprint | null {
  const supportNeed = getCropSupportNeed(crop);
  const kind = supportKind ?? supportNeed?.kind;

  if (!supportNeed || !kind) {
    return null;
  }

  const depthFt = kind === 'trellis' ? 0.5 : 1;
  const widthFt = Math.min(
    kind === 'trellis'
      ? Math.max(cropFootprint.widthFt, 2)
      : Math.max(Math.min(cropFootprint.widthFt, 1), 1),
    garden.plot.widthFt,
  );
  const heightFt = Math.max((crop.matureHeightInches ?? 72) / 12, 5);
  const xFt = clamp(cropFootprint.xFt, 0, garden.plot.widthFt - widthFt);
  const edgeOptions = [
    { xFt, yFt: cropFootprint.yFt - depthFt },
    { xFt, yFt: cropFootprint.yFt + cropFootprint.depthFt },
  ];
  const options = [
    ...edgeOptions,
    ...(kind === 'trellis'
      ? []
      : [
          {
            xFt: clamp(
              cropFootprint.xFt + cropFootprint.widthFt / 2 - widthFt / 2,
              0,
              garden.plot.widthFt - widthFt,
            ),
            yFt: clamp(
              cropFootprint.yFt + cropFootprint.depthFt / 2 - depthFt / 2,
              0,
              garden.plot.depthFt - depthFt,
            ),
          },
        ]),
  ];
  const occupiedRects = garden.structures
    .filter(isBlockingStructure)
    .map(getStructureFootprint);

  for (const option of options) {
    const supportFootprint = {
      depthFt,
      heightFt,
      id: 'support-preview',
      itemType: 'structure' as const,
      label: 'Support preview',
      widthFt,
      xFt: option.xFt,
      yFt: option.yFt,
    };

    if (
      isRectInsidePlot(supportFootprint, garden.plot) &&
      ![...occupiedRects, ...blockedRects].some((rect) =>
        rectsOverlap(rect, supportFootprint),
      )
    ) {
      return {
        depthFt,
        heightFt,
        widthFt,
        xFt: option.xFt,
        yFt: option.yFt,
      };
    }
  }

  return null;
}

export function hasExistingSupport(garden: Garden, footprint: FootRect) {
  return hasNearbySupportFootprint(garden, footprint);
}

export function isBlockingStructure(structure: { type: string }) {
  return isBlockingSavedStructure(structure);
}

function shouldReservePlanting(
  planting: Planting,
  proposedPlanting: Planting | null,
  referenceDate: Date,
) {
  if (!doesPlantingReserveSpace(planting)) {
    return false;
  }

  if (isPlantingAnchoredForOptimizer(planting)) {
    return true;
  }

  if (isAutoLayoutItem(planting)) {
    return false;
  }

  return proposedPlanting
    ? occupancyWindowsOverlap(planting, proposedPlanting, referenceDate)
    : true;
}

function occupancyWindowsOverlap(
  left: Planting,
  right: Planting,
  referenceDate: Date,
) {
  const leftWindow = getOccupancyWindow(left, referenceDate);
  const rightWindow = getOccupancyWindow(right, referenceDate);

  return (
    leftWindow.start < rightWindow.end && rightWindow.start < leftWindow.end
  );
}

function getOccupancyWindow(planting: Planting, referenceDate: Date) {
  const crop = getCropById(planting.cropId);
  const start =
    planting.plantedOn ?? planting.plannedFor ?? toLocalDate(referenceDate);
  const days = crop?.daysToMaturity ?? 75;

  return {
    end: planting.status === 'harvested' ? start : addDays(start, days + 14),
    start,
  };
}

function isAutoLayoutItem(item: { id: string; notes?: string }) {
  return (
    item.id.includes(autoLayoutProposalMarker) ||
    item.notes?.includes(autoLayoutProposalMarker)
  );
}

function addDays(date: string, days: number) {
  return toLocalDate(
    new Date(new Date(`${date}T00:00:00.000Z`).getTime() + days * dayMs),
  );
}

function toLocalDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}
