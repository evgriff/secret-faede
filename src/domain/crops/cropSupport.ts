import type {
  CropProfile,
  CropSupportKind,
  CropSupportProfile,
  CropSupportScope,
  PlantSupportType,
} from './cropCatalogTypes';

type PlantLevelSupportKind = Exclude<CropSupportKind, 'none' | 'trellis'>;

export type CropSupportNeed = CropSupportProfile & {
  kind: Exclude<CropSupportKind, 'none'>;
  scope: Exclude<CropSupportScope, 'none'>;
};

const tomatoSourceTags = [
  'extension:uga-tomato-staking',
  'extension:umn-trellises-cages',
];
const trellisSourceTags = [
  'extension:umn-trellises-cages',
  'extension:uw-vertical-support',
];
const eggplantSourceTags = ['extension:umn-eggplant'];

export function getCropSupportProfile(crop: CropProfile): CropSupportProfile {
  return normalizeCropSupportProfile(
    crop.supportProfile,
    getFallbackCropSupportProfile(crop),
  );
}

export function getCropSupportNeed(crop: CropProfile): CropSupportNeed | null {
  const profile = getCropSupportProfile(crop);

  if (
    profile.scope === 'none' ||
    profile.kind === 'none' ||
    (!profile.required && !profile.recommended)
  ) {
    return null;
  }

  return profile as CropSupportNeed;
}

export function normalizeCropSupportProfile(
  value: unknown,
  fallback: CropSupportProfile = noSupportProfile(),
): CropSupportProfile {
  if (!isRecord(value)) {
    return fallback;
  }

  const kind = readSupportKind(value.kind, fallback.kind);
  const scope = readSupportScope(value.scope, fallback.scope);
  const plantSupportType = readPlantSupportType(
    value.plantSupportType,
    fallback.plantSupportType,
  );

  if (scope === 'none' || kind === 'none') {
    return noSupportProfile(value.sourceTags);
  }

  if (
    (scope === 'structure' && kind !== 'trellis') ||
    (scope === 'plant' && kind === 'trellis')
  ) {
    return fallback;
  }

  return {
    kind,
    label: readString(value.label, fallback.label),
    plantSupportType,
    reason: readString(value.reason, fallback.reason),
    recommended: readBoolean(value.recommended, fallback.recommended),
    required: readBoolean(value.required, fallback.required),
    scope,
    sourceTags: readStringArray(value.sourceTags, fallback.sourceTags),
  };
}

export function getFallbackCropSupportProfile(
  crop: Pick<
    CropProfile,
    | 'commonName'
    | 'growthForm'
    | 'id'
    | 'matureHeightInches'
    | 'roles'
    | 'trellisRecommended'
    | 'trellisRequired'
  >,
): CropSupportProfile {
  const text = getCropSearchText(crop);

  if (/\btomato|tomatoes\b/.test(text)) {
    return plantSupportProfile({
      kind: 'cage',
      label: 'Cage or stake recommended',
      plantSupportType: 'cage',
      reason:
        'Tomatoes are tall, heavy fruiting crops that are commonly caged, staked, or stake-and-weaved.',
      recommended: true,
      required: false,
      sourceTags: tomatoSourceTags,
    });
  }

  if (/\beggplant|aubergine\b/.test(text)) {
    return plantSupportProfile({
      kind: 'stake',
      label: 'Stake recommended',
      plantSupportType: 'stake',
      reason:
        'Eggplant stems can lodge under fruit load; extension guidance recommends staking as plants grow.',
      recommended: true,
      required: false,
      sourceTags: eggplantSourceTags,
    });
  }

  if (isTrellisCrop(crop, text)) {
    const required = crop.trellisRequired || crop.growthForm === 'climber';

    return structureSupportProfile({
      label: required ? 'Trellis required' : 'Trellis recommended',
      reason: `${crop.commonName} is best managed with a saved trellis structure on the plot.`,
      recommended: true,
      required,
      sourceTags: trellisSourceTags,
    });
  }

  if (/\bpepper|peppers|capsicum\b/.test(text)) {
    return plantSupportProfile({
      kind: 'stake',
      label: 'Stake if exposed',
      plantSupportType: 'stake',
      reason:
        'Peppers are usually self-supporting, but staking helps plants carrying heavy fruit or growing in wind.',
      recommended: false,
      required: false,
      sourceTags: trellisSourceTags,
    });
  }

  if (crop.growthForm === 'bush' && (crop.matureHeightInches ?? 0) >= 36) {
    return plantSupportProfile({
      kind: 'stake',
      label: 'Stake if exposed',
      plantSupportType: 'stake',
      reason: `${crop.commonName} is tall enough that a stake can help in wind or heavy fruiting.`,
      recommended: false,
      required: false,
      sourceTags: trellisSourceTags,
    });
  }

  return noSupportProfile();
}

function noSupportProfile(sourceTags: unknown = []): CropSupportProfile {
  return {
    kind: 'none',
    label: 'No default support',
    plantSupportType: null,
    reason: 'No support is normally needed for this crop.',
    recommended: false,
    required: false,
    scope: 'none',
    sourceTags: readStringArray(sourceTags, []),
  };
}

function plantSupportProfile(input: {
  kind: PlantLevelSupportKind;
  label: string;
  plantSupportType: PlantSupportType;
  reason: string;
  recommended: boolean;
  required: boolean;
  sourceTags: string[];
}): CropSupportProfile {
  return { ...input, scope: 'plant' };
}

function structureSupportProfile(input: {
  label: string;
  reason: string;
  recommended: boolean;
  required: boolean;
  sourceTags: string[];
}): CropSupportProfile {
  return {
    ...input,
    kind: 'trellis',
    plantSupportType: null,
    scope: 'structure',
  };
}

function isTrellisCrop(
  crop: Pick<
    CropProfile,
    | 'commonName'
    | 'growthForm'
    | 'id'
    | 'matureHeightInches'
    | 'roles'
    | 'trellisRecommended'
    | 'trellisRequired'
  >,
  text: string,
) {
  if (
    /\b(watermelon|pumpkin|winter squash|butternut|hubbard|acorn squash|spaghetti squash)\b/.test(
      text,
    )
  ) {
    return false;
  }

  return (
    crop.trellisRequired ||
    crop.trellisRecommended ||
    crop.growthForm === 'climber' ||
    crop.growthForm === 'vining' ||
    /\b(pole bean|snap pea|snow pea|pea|grape|raspberry|blackberry|malabar spinach)\b/.test(
      text,
    )
  );
}

function getCropSearchText(
  crop: Pick<CropProfile, 'commonName' | 'id' | 'roles'>,
) {
  return `${crop.id} ${crop.commonName} ${(crop.roles ?? []).join(' ')}`.toLowerCase();
}

function readSupportKind(
  value: unknown,
  fallback: CropSupportKind,
): CropSupportKind {
  return typeof value === 'string' && isCropSupportKind(value)
    ? value
    : fallback;
}

function readSupportScope(
  value: unknown,
  fallback: CropSupportScope,
): CropSupportScope {
  return value === 'none' || value === 'plant' || value === 'structure'
    ? value
    : fallback;
}

function readPlantSupportType(
  value: unknown,
  fallback: PlantSupportType | null,
): PlantSupportType | null {
  return typeof value === 'string' && isPlantSupportType(value)
    ? value
    : fallback;
}

function isCropSupportKind(value: string): value is CropSupportKind {
  return [
    'cage',
    'custom',
    'netting',
    'none',
    'rowCover',
    'stake',
    'stakeAndWeave',
    'trellis',
  ].includes(value);
}

function isPlantSupportType(value: string): value is PlantSupportType {
  return [
    'cage',
    'custom',
    'netting',
    'none',
    'rowCover',
    'stake',
    'stakeAndWeave',
  ].includes(value);
}

function readString(value: unknown, fallback: string) {
  return typeof value === 'string' && value.trim() ? value : fallback;
}

function readBoolean(value: unknown, fallback: boolean) {
  return typeof value === 'boolean' ? value : fallback;
}

function readStringArray(value: unknown, fallback: string[]) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : fallback;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}
