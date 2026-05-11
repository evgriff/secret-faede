import type {
  CropCategory,
  CropProfile,
  CropWaterNeed,
  PlantingMode,
  SunExposure,
} from '../../domain/gardens/GardenRepository';
import { derivePlantingGeometry } from '../../domain/gardens/plantingGeometry';
import type { CropCatalogFilters } from '../../domain/crops/cropCatalog';
import type { CropSuitabilityScore } from '../../domain/crops/cropSuitability';
import type { PlantTimingStatus } from '../../domain/crops/plantCatalogTypes';

export const modeLabels: Record<PlantingMode, string> = {
  block: 'Block',
  cluster: 'Cluster',
  row: 'Row',
  single: 'Single',
  trellisLine: 'Trellis',
};

export interface RankedCropPickerResult {
  baseOrder: number;
  crop: CropProfile;
  suitability: CropSuitabilityScore;
}

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
  const geometry = derivePlantingGeometry({
    matureSpreadInches: crop.matureSpreadInches,
    mode,
    quantity,
    rowSpacingInches: crop.rowSpacingInches,
    spacingInches: crop.spacingInches ?? crop.matureSpreadInches,
    xFt: 0,
    yFt: 0,
  });

  if (mode === 'row' || mode === 'trellisLine') {
    const rowLengthFt = geometry.dimensions.rowLengthFt;

    return {
      blockDepthFt: null,
      blockWidthFt: null,
      clusterRadiusFt: null,
      requestedAreaSqFt:
        geometry.footprint.widthFt * geometry.footprint.depthFt,
      rowLengthFt,
    };
  }

  if (mode === 'block') {
    const blockWidthFt = geometry.dimensions.blockWidthFt ?? spacingFt;
    const blockDepthFt = geometry.dimensions.blockDepthFt ?? rowSpacingFt;

    return {
      blockDepthFt,
      blockWidthFt,
      clusterRadiusFt: null,
      requestedAreaSqFt:
        geometry.footprint.widthFt * geometry.footprint.depthFt,
      rowLengthFt: null,
    };
  }

  if (mode === 'cluster') {
    const clusterRadiusFt = geometry.dimensions.clusterRadiusFt ?? 0;

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

export function compareCropPickerResults(
  left: RankedCropPickerResult,
  right: RankedCropPickerResult,
  options: {
    query: string;
  },
) {
  const normalizedQuery = options.query.trim();

  if (normalizedQuery) {
    const searchDelta = left.baseOrder - right.baseOrder;

    if (searchDelta !== 0) {
      return searchDelta;
    }
  }

  return (
    getLocationBandRank(right.suitability) -
      getLocationBandRank(left.suitability) ||
    getTimingRank(right.suitability.timing.status) -
      getTimingRank(left.suitability.timing.status) ||
    getSunRank(right.suitability) - getSunRank(left.suitability) ||
    right.suitability.score - left.suitability.score ||
    left.baseOrder - right.baseOrder
  );
}

export function formatLocationFilterLabel(suitability: CropSuitabilityScore) {
  return suitability.locationHeadline;
}

export function formatLocationSource(
  suitability: CropSuitabilityScore,
  options: {
    concise?: boolean;
  } = {},
) {
  if (suitability.locationContext.source === 'detroitDefault') {
    return options.concise
      ? 'Using Detroit default'
      : `Using ${suitability.locationContext.regionName} as the current default`;
  }

  return options.concise
    ? 'Using saved garden location'
    : `Using ${suitability.locationContext.regionName} from the saved garden`;
}

export function formatTimingLabel(status: PlantTimingStatus) {
  const labels: Record<PlantTimingStatus, string> = {
    goodForFall: 'Good for fall',
    plantNow: 'Plant now',
    possibleNowWithProtection: 'Possible now with protection',
    startIndoorsNow: 'Start indoors now',
    tooLateForSpringWindow: 'Too late for this spring window',
    waitUntilAfterFrost: 'Wait until after frost',
  };

  return labels[status];
}

export function isLocationFit(
  suitability: CropSuitabilityScore,
  filter: 'any' | 'fitsMyLocation',
) {
  if (filter === 'any') {
    return true;
  }

  return (
    suitability.locationMatch.band === 'good' ||
    suitability.locationMatch.band === 'strong'
  );
}

function getLocationBandRank(suitability: CropSuitabilityScore) {
  const ranks = {
    good: 2,
    poor: 0,
    strong: 3,
    watch: 1,
  } satisfies Record<CropSuitabilityScore['locationMatch']['band'], number>;

  return ranks[suitability.locationMatch.band];
}

function getTimingRank(status: PlantTimingStatus) {
  const ranks: Record<PlantTimingStatus, number> = {
    goodForFall: 3,
    plantNow: 6,
    possibleNowWithProtection: 4,
    startIndoorsNow: 5,
    tooLateForSpringWindow: 1,
    waitUntilAfterFrost: 2,
  };

  return ranks[status];
}

function getSunRank(suitability: CropSuitabilityScore) {
  if (suitability.sunCompatible === true) {
    return 2;
  }

  if (suitability.sunCompatible === null) {
    return 1;
  }

  return 0;
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
