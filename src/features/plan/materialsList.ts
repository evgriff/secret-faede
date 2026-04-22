import { getCropById } from '../../domain/crops/cropCatalog';
import type {
  CropProfile,
  Garden,
  Planting,
  Structure,
  StructureMaterial,
} from '../../domain/gardens/GardenRepository';
import {
  buildMaterialCompletenessAddOns,
  type PlanMaterialAddOn,
} from '../garden/planHealthRules';
import {
  estimateSupportLengthFt,
  getCropSupportNeed,
  getSupportLabel,
} from '../garden/gardenStructureRules';

export interface MaterialsList {
  addOns: PlanMaterialAddOn[];
  amendments: string[];
  beds: Array<{ label: string; summary: string }>;
  paths: Array<{ label: string; summary: string }>;
  seedStarts: Array<{ count: number; label: string; method: string }>;
  supports: string[];
  totals: string[];
}

export function buildMaterialsList(garden: Garden): MaterialsList {
  const seedStarts = garden.plantings.map((planting) => {
    const crop = getCropById(planting.cropId);

    return {
      count: Math.max(planting.plantCount ?? 1, 1),
      label: planting.label,
      method:
        crop?.sowMethod === 'transplant'
          ? 'starts'
          : crop?.sowMethod === 'directSow'
            ? 'seed'
            : 'seed or starts',
    };
  });
  const supports = garden.plantings.flatMap((planting) => {
    const crop = getCropById(planting.cropId);
    const support = summarizePlantSupport(planting, crop);

    return support ? [support] : [];
  });
  const structureSupports = garden.structures
    .filter((structure) => structure.type === 'trellis')
    .map(
      (structure) =>
        `${structure.label}: ${formatMeasure(structure.widthFt)} ft saved trellis`,
    );
  const beds = garden.structures.filter(isBedLike).map((structure) => ({
    label: structure.label,
    summary: summarizeBedMaterials(structure),
  }));
  const paths = garden.structures.filter(isPathLike).map((structure) => ({
    label: structure.label,
    summary: summarizePathMaterials(structure),
  }));
  const totals = buildMaterialTotals(garden, beds.length, paths.length);
  const addOns = buildMaterialCompletenessAddOns(garden);
  const amendments =
    beds.length > 0
      ? [
          'Compost or balanced organic amendment for each active bed.',
          'Mulch for unmulched beds and moisture-sensitive crops.',
        ]
      : ['Container mix, compost, and mulch quantities depend on final pots.'];

  return {
    addOns,
    amendments,
    beds,
    paths,
    seedStarts,
    supports: [...supports, ...structureSupports],
    totals,
  };
}

function summarizeBedMaterials(structure: Structure) {
  const areaSqFt = Math.round(structure.widthFt * structure.depthFt);
  const soilCuFt =
    structure.type === 'raisedBed' || structure.type === 'container'
      ? Math.round(
          structure.widthFt *
            structure.depthFt *
            Math.max(structure.heightFt ?? 1, 0.5),
        )
      : null;

  return soilCuFt
    ? `${formatMeasure(structure.widthFt)} by ${formatMeasure(
        structure.depthFt,
      )} ft; about ${soilCuFt} cu ft soil capacity.`
    : `${formatMeasure(structure.widthFt)} by ${formatMeasure(
        structure.depthFt,
      )} ft; ${areaSqFt} sq ft to amend and mulch.`;
}

function summarizePathMaterials(structure: Structure) {
  const areaSqFt = Math.round(structure.widthFt * structure.depthFt);
  const standard = structure.accessiblePath ? 'accessible' : 'standard';
  const continuity = structure.continuousPath ? 'continuous' : 'gap/check';

  return `${areaSqFt} sq ft ${formatMaterial(
    structure.material,
  )}; ${formatMeasure(structure.widthFt)} ft ${standard}, ${continuity}.`;
}

function summarizePlantSupport(planting: Planting, crop: CropProfile | null) {
  if (planting.mode === 'trellisLine' || (planting.trellisLengthFt ?? 0) > 0) {
    const trellisLengthFt =
      planting.trellisLengthFt ??
      planting.rowLengthFt ??
      estimateSupportLengthFt(planting, crop);

    return `${planting.label}: ${formatMeasure(
      trellisLengthFt,
    )} ft trellis/support line`;
  }

  const supportNeed = crop ? getCropSupportNeed(crop) : null;

  if (!supportNeed) {
    return null;
  }

  if (supportNeed.kind === 'trellis') {
    const trellisLengthFt = estimateSupportLengthFt(planting, crop);

    return `${planting.label}: ${formatMeasure(
      trellisLengthFt,
    )} ft trellis/support line`;
  }

  const count = Math.max(planting.plantCount ?? 1, 1);
  const supportName = getSupportLabel(supportNeed.kind);

  return `${planting.label}: ${count} ${supportName}${count === 1 ? '' : 's'}`;
}

function buildMaterialTotals(
  garden: Garden,
  bedCount: number,
  pathCount: number,
) {
  const trellisStructures = garden.structures.filter(
    (structure) => structure.type === 'trellis',
  );
  const totalTrellisLengthFt = trellisStructures.reduce(
    (total, structure) => total + structure.widthFt,
    0,
  );
  const pathAreaByMaterial = garden.structures.filter(isPathLike).reduce(
    (totals, structure) => {
      totals[structure.material] =
        (totals[structure.material] ?? 0) +
        structure.widthFt * structure.depthFt;
      return totals;
    },
    {} as Partial<Record<StructureMaterial, number>>,
  );
  const pathTotals = Object.entries(pathAreaByMaterial).map(
    ([material, areaSqFt]) =>
      `${Math.round(areaSqFt)} sq ft ${formatMaterial(
        material as StructureMaterial,
      )} path surface`,
  );
  const totals = [
    bedCount > 0
      ? `${bedCount} bed/container footprint${bedCount === 1 ? '' : 's'}`
      : null,
    pathCount > 0
      ? `${pathCount} path segment${pathCount === 1 ? '' : 's'}`
      : null,
    totalTrellisLengthFt > 0
      ? `${trellisStructures.length} trellis structure${
          trellisStructures.length === 1 ? '' : 's'
        }, ${formatMeasure(totalTrellisLengthFt)} ft total`
      : null,
    ...pathTotals,
  ];

  return totals.filter((entry): entry is string => Boolean(entry));
}

function isBedLike(structure: Structure) {
  return (
    structure.type === 'bed' ||
    structure.type === 'container' ||
    structure.type === 'inGroundBed' ||
    structure.type === 'raisedBed'
  );
}

function isPathLike(structure: Structure) {
  return structure.type === 'path' || structure.type === 'pathway';
}

function formatMaterial(material: StructureMaterial) {
  return material
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (letter) => letter.toUpperCase());
}

function formatMeasure(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}
