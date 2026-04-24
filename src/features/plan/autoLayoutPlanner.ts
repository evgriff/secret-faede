import {
  createDefaultPlanting,
  type CropProfile,
  type Garden,
  type Planting,
  type PlantingMode,
  type Structure,
} from '../../domain/gardens/GardenRepository';
import { derivePlantingGeometry } from '../../domain/gardens/plantingGeometry';
import { withPlantingInstances } from '../../domain/gardens/plantingInstances';
import {
  getStructureFootprint,
  rectsOverlap,
  type FootRect,
} from '../garden/gardenPlanning';
import { isRectInsidePlot } from '../garden/gardenPlanningGeometry';
import { type SeasonCropLayoutRequest } from './seasonCropPlan';
import type { AutoLayoutStrategy } from './autoLayoutTypes';

export const autoLayoutProposalMarker = '[auto-layout]';

export interface LayoutUnit {
  crop: CropProfile;
  id: string;
  label: string;
  mode: PlantingMode;
  plantCount: number;
  request: SeasonCropLayoutRequest;
  size: { depthFt: number; widthFt: number };
}

export interface Placement {
  planting: Planting;
  unit: LayoutUnit;
}

export interface LayoutZone {
  id: string;
  rect: FootRect;
  type: 'bed' | 'container' | 'open';
}

export function createLayoutUnits(
  request: SeasonCropLayoutRequest,
): LayoutUnit[] {
  const mode =
    request.plantingForm === 'single' && request.quantity > 1
      ? getGroupedFallbackMode(request)
      : request.plantingForm;

  return [createLayoutUnit(request, 1, request.quantity, mode)];
}

export function createPlacementPlanting(
  unit: LayoutUnit,
  center: { xFt: number; yFt: number },
  strategy: AutoLayoutStrategy,
): Planting {
  const planting = createDefaultPlanting({
    id: `${autoLayoutProposalMarker}-${strategy}-${unit.id}`,
    label: unit.label,
    xFt: center.xFt,
    yFt: center.yFt,
  });

  return withPlantingInstances({
    ...planting,
    blockDepthFt: unit.mode === 'block' ? unit.size.depthFt : null,
    blockWidthFt: unit.mode === 'block' ? unit.size.widthFt : null,
    clusterRadiusFt: unit.mode === 'cluster' ? unit.size.widthFt / 2 : null,
    cropId: unit.crop.id,
    matureHeightInches: unit.crop.matureHeightInches,
    matureSpreadInches: unit.crop.matureSpreadInches,
    mode: unit.mode,
    notes: `${autoLayoutProposalMarker} ${
      unit.request.varietyName ||
      unit.request.notes ||
      'Generated from Choose Plants.'
    }`,
    plantCount: unit.plantCount,
    rowCount:
      unit.mode === 'row' ||
      unit.mode === 'block' ||
      unit.mode === 'trellisLine'
        ? 1
        : null,
    rowLengthFt:
      unit.mode === 'row' || unit.mode === 'trellisLine'
        ? unit.size.widthFt
        : null,
    rowSpacingInches: unit.crop.rowSpacingInches,
    spacingInches:
      unit.request.spacingOverrideInches ?? unit.crop.spacingInches,
    sunRequirement: unit.crop.sunRequirement,
    trellisLengthFt: unit.mode === 'trellisLine' ? unit.size.widthFt : null,
    weeklyWaterNeedInches: unit.crop.weeklyWaterNeedInches,
  });
}

export function buildLayoutZones(garden: Garden): LayoutZone[] {
  const bedZones = garden.structures.filter(isBedLike).map((structure) => ({
    id: structure.id,
    rect: getStructureFootprint(structure),
    type:
      structure.type === 'container'
        ? ('container' as const)
        : ('bed' as const),
  }));

  return bedZones.length > 0
    ? bedZones
    : [
        {
          id: 'open-plot',
          rect: {
            depthFt: garden.plot.depthFt,
            id: 'open-plot',
            itemType: 'structure',
            label: 'Open plot',
            widthFt: garden.plot.widthFt,
            xFt: 0,
            yFt: 0,
          },
          type: 'open',
        },
      ];
}

export function zoneCanHost(zone: LayoutZone, unit: LayoutUnit) {
  if (zone.type !== 'container') {
    return true;
  }

  return (
    !unit.crop.trellisRequired &&
    unit.crop.growthForm !== 'vining' &&
    Math.max(unit.size.widthFt, unit.size.depthFt) <=
      Math.max(zone.rect.widthFt, zone.rect.depthFt)
  );
}

export function enumerateCenters(
  garden: Garden,
  zone: FootRect,
  size: { depthFt: number; widthFt: number },
) {
  const step = garden.plot.snapUnitFt * 2;
  const centers: Array<{ xFt: number; yFt: number }> = [];

  for (
    let yFt = zone.yFt + size.depthFt / 2;
    yFt <= zone.yFt + zone.depthFt - size.depthFt / 2 + 0.001;
    yFt += step
  ) {
    for (
      let xFt = zone.xFt + size.widthFt / 2;
      xFt <= zone.xFt + zone.widthFt - size.widthFt / 2 + 0.001;
      xFt += step
    ) {
      centers.push({
        xFt: snap(xFt, garden.plot.snapUnitFt),
        yFt: snap(yFt, garden.plot.snapUnitFt),
      });
    }
  }

  return centers;
}

export function isLegalRect(
  garden: Garden,
  rect: FootRect,
  blockedRects: FootRect[],
  zone: LayoutZone,
) {
  return (
    isRectInsidePlot(rect, garden.plot) &&
    rectInsideRect(rect, zone.rect) &&
    !blockedRects.some((blockedRect) => rectsOverlap(rect, blockedRect))
  );
}

export function sortUnits(units: LayoutUnit[], strategy: AutoLayoutStrategy) {
  return [...units].sort((left, right) => {
    const supportDelta = supportRank(right.crop) - supportRank(left.crop);
    const sizeDelta =
      right.size.widthFt * right.size.depthFt -
      left.size.widthFt * left.size.depthFt;
    const waterDelta = waterRank(right.crop) - waterRank(left.crop);

    if (strategy === 'supportFirst') {
      return (
        supportDelta ||
        sizeDelta ||
        waterDelta ||
        left.id.localeCompare(right.id)
      );
    }

    if (strategy === 'accessFirst') {
      return (
        sizeDelta ||
        waterDelta ||
        supportDelta ||
        left.id.localeCompare(right.id)
      );
    }

    return (
      waterDelta || sizeDelta || supportDelta || left.id.localeCompare(right.id)
    );
  });
}

export function rectInsideRect(rect: FootRect, outer: FootRect) {
  return (
    rect.xFt >= outer.xFt &&
    rect.yFt >= outer.yFt &&
    rect.xFt + rect.widthFt <= outer.xFt + outer.widthFt &&
    rect.yFt + rect.depthFt <= outer.yFt + outer.depthFt
  );
}

export function getStrategyLabel(strategy: AutoLayoutStrategy) {
  if (strategy === 'accessFirst') {
    return 'Keep reach easy';
  }

  return strategy === 'supportFirst' ? 'Easy support spots' : 'Group watering';
}

export function snap(value: number, unit: number) {
  return Number((Math.round(value / unit) * unit).toFixed(3));
}

function createLayoutUnit(
  request: SeasonCropLayoutRequest,
  index: number,
  plantCount: number,
  mode: PlantingMode,
): LayoutUnit {
  const spacingInches =
    request.spacingOverrideInches ??
    request.crop.spacingInches ??
    request.crop.matureSpreadInches ??
    18;
  const rowSpacingFt = Math.max(
    (request.crop.rowSpacingInches ?? spacingInches) / 12,
    1,
  );
  const size = getUnitSize({
    crop: request.crop,
    mode,
    plantCount,
    rowSpacingFt,
    spacingInches,
  });
  const suffix = index > 1 ? ` ${index}` : '';

  return {
    crop: request.crop,
    id: `${request.cropId}-${index}`,
    label: `${request.crop.commonName}${suffix}`,
    mode,
    plantCount,
    request,
    size,
  };
}

function getUnitSize({
  crop,
  mode,
  plantCount,
  rowSpacingFt,
  spacingInches,
}: {
  crop: CropProfile;
  mode: PlantingMode;
  plantCount: number;
  rowSpacingFt: number;
  spacingInches: number;
}) {
  const geometry = derivePlantingGeometry({
    matureSpreadInches: crop.matureSpreadInches,
    mode,
    quantity: plantCount,
    rowSpacingFt,
    spacingInches,
    xFt: 0,
    yFt: 0,
  });

  return {
    depthFt: Math.max(geometry.footprint.depthFt, 0.75),
    widthFt: Math.max(geometry.footprint.widthFt, 0.75),
  };
}

function getGroupedFallbackMode(
  request: SeasonCropLayoutRequest,
): PlantingMode {
  const groupedModes: PlantingMode[] = [
    'trellisLine',
    'block',
    'row',
    'cluster',
  ];

  return (
    groupedModes.find((mode) =>
      request.crop.supportedPlantingModes.includes(mode),
    ) ?? request.plantingForm
  );
}

export function isAutoLayoutItem(item: { id: string; notes?: string }) {
  return (
    item.id.includes(autoLayoutProposalMarker) ||
    item.notes?.includes(autoLayoutProposalMarker)
  );
}

function isBedLike(structure: Structure) {
  return ['bed', 'container', 'inGroundBed', 'raisedBed'].includes(
    structure.type,
  );
}

function supportRank(crop: CropProfile) {
  return crop.trellisRequired ||
    crop.growthForm === 'climber' ||
    crop.growthForm === 'vining'
    ? 3
    : crop.trellisRecommended
      ? 2
      : (crop.matureHeightInches ?? 0) >= 42
        ? 1
        : 0;
}

function waterRank(crop: CropProfile) {
  const ranks = { high: 3, low: 1, medium: 2 };

  return ranks[crop.waterNeeds];
}
