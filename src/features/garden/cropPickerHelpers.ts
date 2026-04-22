import type {
  CropCategory,
  CropProfile,
  CropWaterNeed,
  PlantingMode,
  SunExposure,
} from '../../domain/gardens/GardenRepository';
import type { CropCatalogFilters } from '../../domain/crops/cropCatalog';

export const modeLabels: Record<PlantingMode, string> = {
  block: 'Block',
  cluster: 'Cluster',
  row: 'Row',
  single: 'Single',
  trellisLine: 'Trellis',
};

export function calculatePlantCount(
  crop: CropProfile,
  mode: PlantingMode,
  values: {
    blockDepthFt: string;
    blockWidthFt: string;
    quantity: string;
    rowLengthFt: string;
  },
) {
  const spacingFt = Math.max((crop.spacingInches ?? 12) / 12, 0.25);

  if (mode === 'row' || mode === 'trellisLine') {
    return Math.max(
      Math.floor(parsePositiveNumber(values.rowLengthFt, 6) / spacingFt),
      1,
    );
  }

  if (mode === 'block') {
    const widthFt = parsePositiveNumber(values.blockWidthFt, 4);
    const depthFt = parsePositiveNumber(values.blockDepthFt, 3);

    return Math.max(
      Math.floor(widthFt / spacingFt) * Math.floor(depthFt / spacingFt),
      1,
    );
  }

  return Math.max(Math.round(parsePositiveNumber(values.quantity, 1)), 1);
}

export function calculateRequestedAreaSqFt(
  mode: PlantingMode,
  values: {
    blockDepthFt: string;
    blockWidthFt: string;
    rowLengthFt: string;
  },
) {
  if (mode === 'block') {
    return (
      parsePositiveNumber(values.blockWidthFt, 4) *
      parsePositiveNumber(values.blockDepthFt, 3)
    );
  }

  if (mode === 'row' || mode === 'trellisLine') {
    return parsePositiveNumber(values.rowLengthFt, 6);
  }

  return null;
}

export function parsePositiveNumber(value: string, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function formatGlyph(crop: CropProfile) {
  return (
    cropIconGlyphs[crop.defaultIcon] ??
    cropIconGlyphs[crop.family] ??
    cropIconGlyphs[crop.category] ??
    cropIconGlyphs[crop.growthForm] ??
    formatInitialGlyph(crop.commonName)
  );
}

export function getCropIconTone(crop: CropProfile): CropIconTone {
  if (crop.roles.includes('coverCrop') || crop.defaultIcon === 'coverCrop') {
    return 'coverCrop';
  }

  if (
    crop.roles.includes('berry') ||
    berryIconKeys.has(crop.defaultIcon) ||
    berryFamilies.has(crop.family)
  ) {
    return 'berry';
  }

  if (crop.defaultIcon === 'tree') {
    return 'tree';
  }

  if (crop.growthForm === 'climber' || crop.growthForm === 'vining') {
    return 'vining';
  }

  return crop.category;
}

export function formatCropFamilyLine(crop: CropProfile) {
  return `${formatLabel(crop.category)} - ${crop.family}`;
}

export function formatCropSpacing(crop: CropProfile) {
  return crop.spacingInches ? `${crop.spacingInches} in` : 'Spacing varies';
}

export function formatSun(value: SunExposure) {
  return sunLabels[value];
}

export function formatWater(value: CropWaterNeed) {
  return `${formatLabel(value)} water`;
}

export function formatSowMethod(
  value: NonNullable<CropCatalogFilters['sowMethod']>,
) {
  if (value === 'directSow') {
    return 'Direct sow';
  }

  return formatLabel(value);
}

export function formatLabel(value: string) {
  return value
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (letter) => letter.toUpperCase());
}

export function formatConfidence(value: CropProfile['profileConfidence']) {
  const labels: Record<CropProfile['profileConfidence'], string> = {
    complete: 'Complete profile',
    needsReview: 'Needs review',
    partial: 'Partial profile',
  };

  return labels[value];
}

const cropIconGlyphs: Record<string, string> = {
  allium: '🧅',
  apple: '🍎',
  Apiaceae: '🥕',
  Amaranthaceae: '🌿',
  Amaryllidaceae: '🧅',
  artichoke: '🌿',
  Asparagaceae: '🌿',
  asparagus: '🌿',
  Asteraceae: '🌻',
  bean: '🫘',
  berry: '🫐',
  blackberry: '🫐',
  blueberry: '🫐',
  brassica: '🥬',
  Brassicaceae: '🥬',
  carrot: '🥕',
  celery: '🌿',
  cherry: '🍒',
  climber: '🌱',
  corn: '🌽',
  coverCrop: '🌱',
  cucumber: '🥒',
  currant: '🫐',
  Cucurbitaceae: '🥒',
  eggplant: '🍆',
  elderberry: '🫐',
  Fabaceae: '🫘',
  fig: '🍈',
  flower: '✿',
  fruit: '🍎',
  gooseberry: '🫐',
  grain: '🌾',
  grape: '🍇',
  groundCherry: '🍅',
  herb: '🌿',
  leafy: '🥬',
  leafyGreen: '🥬',
  legume: '🫘',
  Lamiaceae: '🌿',
  melon: '🍈',
  okra: '🌿',
  pea: '🟢',
  peach: '🍑',
  peanut: '🥜',
  pear: '🍐',
  pepper: '🌶',
  plum: '🍑',
  Poaceae: '🌾',
  potato: '🥔',
  Polygonaceae: '🌿',
  pumpkin: '🎃',
  raspberry: '🫐',
  rhubarb: '🌿',
  root: '🥕',
  Rosaceae: '🍓',
  Solanaceae: '🍅',
  squash: '🥒',
  sunflower: '🌻',
  tomatillo: '🟢',
  tomato: '🍅',
  tree: '🌳',
  upright: '🌱',
  vegetable: '🌱',
  vining: '🌿',
};

const sunLabels: Record<SunExposure, string> = {
  fullShade: 'Shade',
  fullSun: 'Full sun',
  partShade: 'Part shade',
  partSun: 'Part sun',
};

const berryIconKeys = new Set([
  'berry',
  'blackberry',
  'blueberry',
  'currant',
  'elderberry',
  'gooseberry',
  'raspberry',
]);
const berryFamilies = new Set(['Ericaceae', 'Grossulariaceae']);

type CropIconTone = CropCategory | 'berry' | 'coverCrop' | 'tree' | 'vining';

function formatInitialGlyph(value: string) {
  return value
    .split(/[-_\s]+/)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}
