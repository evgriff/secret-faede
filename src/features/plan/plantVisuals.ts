import type {
  CropProfile,
  Planting,
} from '../../domain/gardens/GardenRepository';
import { pixelsPerFoot } from '../garden/gardenMath';

export type PlantGroupIconKey =
  | 'brassica'
  | 'flower'
  | 'fruit'
  | 'grain'
  | 'herb'
  | 'leafy'
  | 'pepper'
  | 'root'
  | 'tomato'
  | 'vine';

export type PlantGroupLabelPlacement = 'above' | 'inside' | 'right';

export interface PlantGroupPalette {
  accent: string;
  dot: string;
  dotAlt: string;
  soft: string;
  strong: string;
}

export interface PlantGroupVisual {
  icon: PlantGroupIconKey;
  mark: string;
  palette: PlantGroupPalette;
}

export interface PlantGroupLabelDecision {
  hasHoverRoom: boolean;
  hasInteriorRoom: boolean;
  maxWidthPx: number;
  placement: PlantGroupLabelPlacement;
  visible: boolean;
}

const iconMatchers: Array<{
  icon: PlantGroupIconKey;
  pattern: RegExp;
}> = [
  { icon: 'tomato', pattern: /tomato/ },
  { icon: 'pepper', pattern: /pepper|chile|chili/ },
  { icon: 'root', pattern: /carrot|beet|radish|turnip|parsnip|potato|root/ },
  {
    icon: 'vine',
    pattern: /pea|bean|cucumber|melon|squash|pumpkin|vine|climber|trellis/,
  },
  {
    icon: 'herb',
    pattern: /basil|cilantro|parsley|dill|mint|sage|thyme|oregano|herb/,
  },
  {
    icon: 'flower',
    pattern: /flower|marigold|sunflower|zinnia|nasturtium|calendula/,
  },
  {
    icon: 'brassica',
    pattern: /brassica|broccoli|cabbage|kale|cauliflower|collard/,
  },
  { icon: 'grain', pattern: /corn|maize|grain|wheat|rye|oat/ },
  { icon: 'fruit', pattern: /strawberry|berry|apple|grape|fruit/ },
  { icon: 'leafy', pattern: /lettuce|spinach|greens?|chard|leafy|rosette/ },
];

const palettes: Record<PlantGroupIconKey, PlantGroupPalette> = {
  brassica: {
    accent: '#436c50',
    dot: '#557d55',
    dotAlt: '#8ba646',
    soft: 'rgba(222, 238, 217, 0.94)',
    strong: '#284935',
  },
  flower: {
    accent: '#996d16',
    dot: '#c59524',
    dotAlt: '#9b4b58',
    soft: 'rgba(249, 235, 184, 0.94)',
    strong: '#6f4d0d',
  },
  fruit: {
    accent: '#9d3f3a',
    dot: '#c85746',
    dotAlt: '#7f9a3b',
    soft: 'rgba(246, 221, 205, 0.94)',
    strong: '#713129',
  },
  grain: {
    accent: '#8a6a1c',
    dot: '#b88b20',
    dotAlt: '#486d4f',
    soft: 'rgba(247, 233, 188, 0.94)',
    strong: '#664b12',
  },
  herb: {
    accent: '#2f7751',
    dot: '#3f8b5e',
    dotAlt: '#88a348',
    soft: 'rgba(218, 239, 219, 0.94)',
    strong: '#20583a',
  },
  leafy: {
    accent: '#326f43',
    dot: '#3d8b55',
    dotAlt: '#8aa348',
    soft: 'rgba(222, 241, 212, 0.94)',
    strong: '#24472e',
  },
  pepper: {
    accent: '#a64632',
    dot: '#c4553d',
    dotAlt: '#6f8f3b',
    soft: 'rgba(247, 221, 205, 0.94)',
    strong: '#753124',
  },
  root: {
    accent: '#ad651f',
    dot: '#d3832f',
    dotAlt: '#7c9343',
    soft: 'rgba(249, 230, 198, 0.94)',
    strong: '#814710',
  },
  tomato: {
    accent: '#ad3f34',
    dot: '#c94b3f',
    dotAlt: '#6f9239',
    soft: 'rgba(247, 218, 204, 0.94)',
    strong: '#7d2d25',
  },
  vine: {
    accent: '#24735a',
    dot: '#2f8d68',
    dotAlt: '#84a542',
    soft: 'rgba(214, 238, 224, 0.94)',
    strong: '#185642',
  },
};

export function getPlantGroupVisual(
  crop: CropProfile | null,
  plant: Planting,
): PlantGroupVisual {
  const icon = getPlantGroupIcon(crop, plant);

  return {
    icon,
    mark: getPlantMark(plant.label || crop?.commonName || ''),
    palette: palettes[icon],
  };
}

export function getPlantGroupLabelDecision({
  dragging,
  footprint,
  hovering,
  label,
  pinned,
}: {
  dragging: boolean;
  footprint: { depthFt: number; widthFt: number };
  hovering: boolean;
  label: string;
  pinned: boolean;
}): PlantGroupLabelDecision {
  const widthPx = Math.max(footprint.widthFt * pixelsPerFoot, 1);
  const depthPx = Math.max(footprint.depthFt * pixelsPerFoot, 1);
  const estimatedLabelPx = estimateLabelWidthPx(label);
  const hasInteriorRoom = widthPx >= estimatedLabelPx + 18 && depthPx >= 58;
  const hasHoverRoom =
    hasInteriorRoom || (widthPx >= 58 && depthPx >= 42) || widthPx >= 92;
  const placement = hasInteriorRoom
    ? 'inside'
    : widthPx >= 52
      ? 'above'
      : 'right';

  return {
    hasHoverRoom,
    hasInteriorRoom,
    maxWidthPx:
      placement === 'inside'
        ? clamp(widthPx - 12, 58, 190)
        : clamp(Math.max(widthPx + 44, estimatedLabelPx), 92, 210),
    placement,
    visible:
      !dragging && (hasInteriorRoom || pinned || (hovering && hasHoverRoom)),
  };
}

function getPlantGroupIcon(
  crop: CropProfile | null,
  plant: Planting,
): PlantGroupIconKey {
  const text = [
    crop?.commonName,
    crop?.name,
    crop?.defaultIcon,
    crop?.category,
    crop?.growthForm,
    crop?.roles.join(' '),
    crop?.family,
    plant.label,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return (
    iconMatchers.find((matcher) => matcher.pattern.test(text))?.icon ?? 'leafy'
  );
}

function estimateLabelWidthPx(label: string) {
  return clamp(label.trim().length * 6.4 + 30, 58, 184);
}

function getPlantMark(label: string) {
  return label.trim().slice(0, 1).toUpperCase() || 'P';
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}
