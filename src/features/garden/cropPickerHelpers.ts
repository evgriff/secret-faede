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
  _crop: CropProfile,
  _mode: PlantingMode,
  values: {
    blockDepthFt: string;
    blockWidthFt: string;
    quantity: string;
    rowLengthFt: string;
  },
) {
  return coercePlantQuantity(values.quantity);
}

export function calculateRequestedAreaSqFt(
  mode: PlantingMode,
  values: {
    blockDepthFt: string;
    blockWidthFt: string;
    clusterRadiusFt?: string;
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

  if (mode === 'cluster') {
    const radiusFt = parsePositiveNumber(values.clusterRadiusFt ?? '', 1);

    return Math.PI * radiusFt * radiusFt;
  }

  return null;
}

export function coercePlantQuantity(value: number | string) {
  const parsed = typeof value === 'number' ? value : Number(value);
  const quantity = Number.isFinite(parsed) ? parsed : 1;

  return Math.max(1, Math.min(999, Math.round(quantity)));
}

export function getRecommendedPlantingMode(
  crop: CropProfile,
  quantityInput: number | string,
): PlantingMode {
  const quantity = coercePlantQuantity(quantityInput);
  const supportedModes = crop.supportedPlantingModes;

  if (quantity <= 1 && supportedModes.includes('single')) {
    return 'single';
  }

  if (
    quantity > 1 &&
    (crop.trellisRequired || crop.trellisRecommended) &&
    supportedModes.includes('trellisLine')
  ) {
    return 'trellisLine';
  }

  if (quantity >= 9 && supportedModes.includes('block')) {
    return 'block';
  }

  if (quantity > 1 && supportedModes.includes('row')) {
    return 'row';
  }

  if (quantity > 1 && supportedModes.includes('cluster')) {
    return 'cluster';
  }

  if (supportedModes.includes('single')) {
    return 'single';
  }

  return supportedModes[0] ?? 'single';
}

export function getPlantingArrangementDefaults(
  crop: CropProfile,
  mode: PlantingMode,
  quantityInput: number | string,
) {
  const quantity = coercePlantQuantity(quantityInput);
  const spacingFt = getCropSpacingFt(crop);
  const rowSpacingFt = getCropRowSpacingFt(crop, spacingFt);

  if (mode === 'row' || mode === 'trellisLine') {
    const rowLengthFt = Math.max(
      quantity > 1 ? spacingFt * (quantity - 1) : spacingFt,
      spacingFt,
    );

    return {
      blockDepthFt: null,
      blockWidthFt: null,
      clusterRadiusFt: null,
      requestedAreaSqFt: rowLengthFt,
      rowLengthFt,
    };
  }

  if (mode === 'block') {
    const columns = Math.max(1, Math.ceil(Math.sqrt(quantity)));
    const rows = Math.max(1, Math.ceil(quantity / columns));
    const blockWidthFt = Math.max(
      spacingFt * Math.max(columns - 1, 1),
      spacingFt,
    );
    const blockDepthFt = Math.max(
      rowSpacingFt * Math.max(rows - 1, 1),
      rowSpacingFt,
    );

    return {
      blockDepthFt,
      blockWidthFt,
      clusterRadiusFt: null,
      requestedAreaSqFt: blockWidthFt * blockDepthFt,
      rowLengthFt: null,
    };
  }

  if (mode === 'cluster') {
    const clusterRadiusFt = Math.max(
      (Math.sqrt(quantity) * spacingFt) / 2,
      0.5,
    );

    return {
      blockDepthFt: null,
      blockWidthFt: null,
      clusterRadiusFt,
      requestedAreaSqFt: Math.PI * clusterRadiusFt * clusterRadiusFt,
      rowLengthFt: null,
    };
  }

  return {
    blockDepthFt: null,
    blockWidthFt: null,
    clusterRadiusFt: null,
    requestedAreaSqFt: null,
    rowLengthFt: null,
  };
}

export function formatFeetInput(value: number | null) {
  return value === null ? '' : Number(value.toFixed(2)).toString();
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

export function formatProfileCompleteness(
  value: CropProfile['profileCompleteness'],
) {
  const labels: Record<CropProfile['profileCompleteness'], string> = {
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

function getCropSpacingFt(crop: CropProfile) {
  return Math.max(
    (crop.spacingInches ?? crop.matureSpreadInches ?? 12) / 12,
    0.75,
  );
}

function getCropRowSpacingFt(crop: CropProfile, fallbackFt: number) {
  return Math.max(
    (crop.rowSpacingInches ??
      crop.spacingInches ??
      crop.matureSpreadInches ??
      fallbackFt * 12) / 12,
    0.75,
  );
}

function formatInitialGlyph(value: string) {
  return value
    .split(/[-_\s]+/)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}
