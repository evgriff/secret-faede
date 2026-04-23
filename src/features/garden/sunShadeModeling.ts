import { getCropById } from '../../domain/crops/cropCatalog';
import { buildPlantMaturityProfile } from '../../domain/gardens/plantMaturity';
import type {
  Garden,
  Planting,
  Plot,
  Structure,
  SunShadeMicroclimateNote,
  SunShadeSource,
} from '../../domain/gardens/GardenRepository';
import {
  getPlantingFootprint,
  getStructureFootprint,
  type FootRect,
} from './gardenPlanningGeometry';

export interface ShadeCaster {
  canopyRadiusFt: number;
  canopyOpacity: number;
  center: { xFt: number; yFt: number };
  depthFt: number;
  heightFt: number;
  source: SunShadeSource;
  widthFt: number;
}

export function buildShadeCasters(garden: Garden): ShadeCaster[] {
  return [
    ...garden.structures.flatMap(createStructureShadeCaster),
    ...garden.plantings.flatMap(createPlantingShadeCaster),
  ];
}

export function getCellShadeHits(
  cell: { xFt: number; yFt: number },
  shadeCasters: ShadeCaster[],
  plot: Plot,
  sunPosition: { altitude: number; azimuth: number },
) {
  const shadowDirection = getShadowDirection(sunPosition.azimuth, plot);

  return shadeCasters.filter((caster) => {
    const dx = cell.xFt - caster.center.xFt;
    const dy = cell.yFt - caster.center.yFt;
    const projection = dx * shadowDirection.x + dy * shadowDirection.y;
    const perpendicular = Math.abs(
      dx * -shadowDirection.y + dy * shadowDirection.x,
    );
    const shadowLengthFt = Math.min(
      caster.heightFt / Math.tan(Math.max(sunPosition.altitude, 0.1)),
      Math.max(plot.widthFt, plot.depthFt) * 2,
    );
    const shadowWidthFt =
      Math.max(caster.widthFt, caster.depthFt) / 2 + caster.canopyRadiusFt;

    return (
      projection >= 0 &&
      projection <= shadowLengthFt &&
      perpendicular <= Math.max(shadowWidthFt, 0.5)
    );
  });
}

export function getShadePressure(shadeHits: ShadeCaster[]) {
  if (shadeHits.length === 0) {
    return 0;
  }

  return Math.min(
    Math.max(
      ...shadeHits.map((hit) =>
        Number.isFinite(hit.canopyOpacity) ? hit.canopyOpacity : 1,
      ),
    ),
    1,
  );
}

export function buildMicroclimateNotes({
  cell,
  garden,
  shadeSources,
  sunHours,
}: {
  cell: { xFt: number; yFt: number };
  garden: Garden;
  shadeSources: SunShadeSource[];
  sunHours: number;
}) {
  const notes: SunShadeMicroclimateNote[] = [];

  if (
    sunHours <= 3 &&
    shadeSources.some((source) =>
      ['fenceWall', 'tallCrop', 'treeObstacle', 'trellisedCrop'].includes(
        source.kind,
      ),
    )
  ) {
    notes.push(
      createMicroclimateNote(
        'coolShadePocket',
        'Cool shade pocket',
        'Modeled shade suggests a cooler pocket; confirm with field observation before relying on it.',
      ),
    );
  }

  if (sunHours >= 6 && isWestHeatEdge(cell, garden.plot)) {
    notes.push(
      createMicroclimateNote(
        'westHeat',
        'West heat',
        'Late-day heat may build near this exposed edge during warm weather.',
      ),
    );
  }

  if (sunHours >= 5.5 && hasReflectiveSurfaceNear(cell, garden.structures)) {
    notes.push(
      createMicroclimateNote(
        'reflectedHeat',
        'Reflected heat',
        'Nearby hard surface may add reflected heat beyond the direct-sun estimate.',
      ),
    );
  }

  if (
    isOuterEdge(cell, garden.plot) &&
    !hasWindBreakNear(cell, garden.structures)
  ) {
    notes.push(
      createMicroclimateNote(
        'windExposedEdge',
        'Wind-exposed edge',
        'Open edge may dry out faster if the garden has no local windbreak here.',
      ),
    );
  }

  return notes.slice(0, 2);
}

function createStructureShadeCaster(structure: Structure): ShadeCaster[] {
  const heightFt = structure.heightFt ?? 0;

  if (heightFt <= 0 || !structureCastsShade(structure, heightFt)) {
    return [];
  }

  return [
    createShadeCaster({
      canopyRadiusFt: structure.canopyRadiusFt ?? 0,
      canopyOpacity: 0.82,
      footprint: getStructureFootprint(structure),
      heightFt,
      source: {
        canopyOpacity: 0.82,
        heightFt,
        itemId: structure.id,
        itemType: 'structure',
        kind: getStructureShadeKind(structure),
        label: structure.label,
      },
    }),
  ];
}

function createPlantingShadeCaster(planting: Planting): ShadeCaster[] {
  if (planting.status === 'harvested' || planting.status === 'removed') {
    return [];
  }

  const crop = planting.cropId ? getCropById(planting.cropId) : null;
  const maturity = buildPlantMaturityProfile({ crop, planting });
  const trellised =
    planting.mode === 'trellisLine' || (planting.trellisLengthFt ?? 0) > 0;
  const heightFt = maturity.effectiveHeightFt;

  if (!trellised && heightFt < 4) {
    return [];
  }

  return [
    createShadeCaster({
      canopyRadiusFt: maturity.canopyRadiusFt,
      canopyOpacity: maturity.canopyOpacity,
      footprint: getPlantingFootprint(planting),
      heightFt,
      source: {
        canopyDensity: maturity.canopyDensity,
        canopyOpacity: maturity.canopyOpacity,
        growthStage: maturity.growthStage,
        heightFt,
        itemId: planting.id,
        itemType: 'planting',
        kind: trellised ? 'trellisedCrop' : 'tallCrop',
        label: planting.label,
        matureHeightFt: maturity.matureHeightFt,
        matureSpreadFt: maturity.matureSpreadFt,
        supportHeightFt: maturity.supportHeightFt,
      },
    }),
  ];
}

function createShadeCaster({
  canopyRadiusFt,
  canopyOpacity,
  footprint,
  heightFt,
  source,
}: {
  canopyRadiusFt: number;
  canopyOpacity: number;
  footprint: FootRect;
  heightFt: number;
  source: SunShadeSource;
}): ShadeCaster {
  return {
    canopyRadiusFt,
    canopyOpacity,
    center: {
      xFt: footprint.xFt + footprint.widthFt / 2,
      yFt: footprint.yFt + footprint.depthFt / 2,
    },
    depthFt: footprint.depthFt,
    heightFt,
    source,
    widthFt: footprint.widthFt,
  };
}

function structureCastsShade(structure: Structure, heightFt: number) {
  switch (structure.type) {
    case 'compost':
    case 'fence':
    case 'fenceWall':
    case 'other':
    case 'treeObstacle':
    case 'trellis':
      return true;
    case 'bed':
    case 'container':
    case 'raisedBed':
      return heightFt >= 2.5;
    case 'hoseBib':
    case 'inGroundBed':
    case 'path':
    case 'pathway':
    case 'waterSource':
      return false;
  }
}

function getStructureShadeKind(structure: Structure): SunShadeSource['kind'] {
  switch (structure.type) {
    case 'fence':
    case 'fenceWall':
      return 'fenceWall';
    case 'treeObstacle':
      return 'treeObstacle';
    case 'trellis':
      return 'trellis';
    default:
      return 'structure';
  }
}

function getShadowDirection(azimuth: number, plot: Plot) {
  const sunAzimuthFromNorth = azimuth + Math.PI;
  const shadowAzimuth = sunAzimuthFromNorth + Math.PI;
  const plotRotation = (plot.orientationDegrees * Math.PI) / 180;
  const angle = shadowAzimuth + plotRotation;

  return {
    x: Math.sin(angle),
    y: -Math.cos(angle),
  };
}

function createMicroclimateNote(
  kind: SunShadeMicroclimateNote['kind'],
  label: string,
  description: string,
): SunShadeMicroclimateNote {
  return {
    description,
    id: `microclimate:${kind}`,
    kind,
    label,
    source: 'modeled',
  };
}

function isWestHeatEdge(cell: { xFt: number; yFt: number }, plot: Plot) {
  const marginFt = Math.min(1.5, Math.max(plot.widthFt, plot.depthFt) / 5);
  const orientation = ((plot.orientationDegrees % 360) + 360) % 360;

  if (orientation < 45 || orientation >= 315) {
    return cell.xFt <= marginFt;
  }

  if (orientation < 135) {
    return cell.yFt >= plot.depthFt - marginFt;
  }

  if (orientation < 225) {
    return cell.xFt >= plot.widthFt - marginFt;
  }

  return cell.yFt <= marginFt;
}

function isOuterEdge(cell: { xFt: number; yFt: number }, plot: Plot) {
  return (
    cell.xFt <= 1.25 ||
    cell.yFt <= 1.25 ||
    cell.xFt >= plot.widthFt - 1.25 ||
    cell.yFt >= plot.depthFt - 1.25
  );
}

function hasReflectiveSurfaceNear(
  cell: { xFt: number; yFt: number },
  structures: Structure[],
) {
  return structures.some(
    (structure) =>
      ['gravel', 'metal', 'pavers', 'stone'].includes(structure.material) &&
      pointRectDistanceFt(cell, structure) <= 2.5,
  );
}

function hasWindBreakNear(
  cell: { xFt: number; yFt: number },
  structures: Structure[],
) {
  return structures.some(
    (structure) =>
      ['fence', 'fenceWall', 'treeObstacle'].includes(structure.type) &&
      pointRectDistanceFt(cell, structure) <= 3,
  );
}

function pointRectDistanceFt(
  point: { xFt: number; yFt: number },
  structure: Structure,
) {
  const dx = Math.max(
    structure.xFt - point.xFt,
    point.xFt - (structure.xFt + structure.widthFt),
    0,
  );
  const dy = Math.max(
    structure.yFt - point.yFt,
    point.yFt - (structure.yFt + structure.depthFt),
    0,
  );

  return Math.sqrt(dx * dx + dy * dy);
}
