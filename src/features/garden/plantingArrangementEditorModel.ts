import type {
  CropProfile,
  PlantingMode,
} from '../../domain/gardens/GardenRepository';
import type { PlanWarning } from './gardenPlanning';
import {
  formatFeetInput,
  getPlantingArrangementDefaults,
  modeLabels,
} from './cropPickerHelpers';

export interface ArrangementEditorValues {
  blockDepthFt: number | null;
  blockWidthFt: number | null;
  clusterRadiusFt: number | null;
  rowLengthFt: number | null;
}

export function getFallbackArrangementDefaults(
  mode: PlantingMode,
  quantity: number,
) {
  return getPlantingArrangementDefaults(
    {
      matureSpreadInches: 12,
      rowSpacingInches: 12,
      spacingInches: 12,
      supportedPlantingModes: [mode],
      trellisRecommended: false,
      trellisRequired: false,
    } as CropProfile,
    mode,
    quantity,
  );
}

export function buildArrangementWarnings({
  crop,
  mode,
  planWarnings,
  quantity,
  recommendedMode,
  spacingFt,
}: {
  crop: CropProfile | null;
  mode: PlantingMode;
  planWarnings: PlanWarning[];
  quantity: number;
  recommendedMode: PlantingMode;
  spacingFt: number;
}) {
  const warnings: string[] = [];

  if (mode !== recommendedMode) {
    warnings.push(
      `Changed from recommended ${formatArrangementMode(
        recommendedMode,
        quantity,
      )}.`,
    );
  }

  if (crop) {
    const catalogSpacingFt =
      (crop.spacingInches ?? crop.matureSpreadInches ?? 12) / 12;
    const spacingLabel = crop.spacingInches ?? crop.matureSpreadInches ?? 12;

    if (quantity > 1 && spacingFt < catalogSpacingFt) {
      warnings.push(
        `Spacing is tighter than the catalog spacing of ${spacingLabel} in.`,
      );
    }

    if (crop.trellisRequired && mode !== 'trellisLine') {
      warnings.push(`${crop.commonName} needs trellis support.`);
    } else if (
      crop.trellisRecommended &&
      quantity > 1 &&
      mode !== 'trellisLine'
    ) {
      warnings.push(`${crop.commonName} usually works better on a trellis.`);
    }
  }

  return [
    ...warnings,
    ...planWarnings.map((warning) => warning.message),
  ].filter(Boolean);
}

export function getEffectiveSpacingFt(
  mode: PlantingMode,
  quantity: number,
  values: ArrangementEditorValues,
) {
  if (mode === 'row' || mode === 'trellisLine') {
    return quantity > 1
      ? Math.max((values.rowLengthFt ?? 1) / (quantity - 1), 0.125)
      : Math.max(values.rowLengthFt ?? 1, 0.125);
  }

  if (mode === 'block') {
    const columns = getBlockColumns(quantity);
    const rows = getBlockRows(quantity, columns);
    const xSpacing =
      columns > 1 ? (values.blockWidthFt ?? 1) / (columns - 1) : null;
    const ySpacing = rows > 1 ? (values.blockDepthFt ?? 1) / (rows - 1) : null;

    return Math.max(xSpacing ?? ySpacing ?? values.blockWidthFt ?? 1, 0.125);
  }

  if (mode === 'cluster') {
    return Math.max(values.clusterRadiusFt ?? 1, 0.125);
  }

  return 1;
}

export function getPreviewPoints(
  mode: PlantingMode,
  quantity: number,
  values: ArrangementEditorValues,
) {
  const points = getArrangementPoints(mode, quantity, values);
  const center = {
    x: average(points.map((point) => point.x)),
    y: average(points.map((point) => point.y)),
  };
  const range = Math.max(
    maxDistance(points.map((point) => point.x)),
    maxDistance(points.map((point) => point.y)),
    1,
  );
  const scale = 48 / range;

  return points.map((point) => ({
    x: 50 + (point.x - center.x) * scale,
    y: 32 + (point.y - center.y) * scale,
  }));
}

export function formatArrangementMetric(
  mode: PlantingMode,
  quantity: number,
  values: ArrangementEditorValues,
) {
  if (mode === 'row' || mode === 'trellisLine') {
    return `${formatFeetInput(values.rowLengthFt ?? 0)} ft line`;
  }

  if (mode === 'block') {
    return `${formatFeetInput(values.blockWidthFt ?? 0)} ft x ${formatFeetInput(
      values.blockDepthFt ?? 0,
    )} ft block`;
  }

  if (mode === 'cluster') {
    return `${formatFeetInput(values.clusterRadiusFt ?? 0)} ft radius`;
  }

  return `${quantity} single plant`;
}

export function formatArrangementMode(mode: PlantingMode, quantity: number) {
  if (mode === 'row') {
    return 'Line';
  }

  if (mode === 'trellisLine') {
    return 'Trellis line';
  }

  if (mode === 'cluster' && quantity === 3) {
    return 'Triangle';
  }

  return modeLabels[mode];
}

export function getSpacingLabel(mode: PlantingMode) {
  if (mode === 'cluster') {
    return 'Spread radius in feet';
  }

  return 'Plant spacing in feet';
}

export function getBlockColumns(quantity: number) {
  return Math.max(1, Math.ceil(Math.sqrt(quantity)));
}

export function getBlockRows(quantity: number, columns: number) {
  return Math.max(1, Math.ceil(quantity / columns));
}

function getArrangementPoints(
  mode: PlantingMode,
  quantity: number,
  values: ArrangementEditorValues,
) {
  if (mode === 'row' || mode === 'trellisLine') {
    const lengthFt = Math.max(values.rowLengthFt ?? quantity - 1, 0.125);
    const startX = -lengthFt / 2;
    const stepFt = quantity > 1 ? lengthFt / (quantity - 1) : 0;

    return Array.from({ length: quantity }, (_, index) => ({
      x: quantity === 1 ? 0 : startX + stepFt * index,
      y: 0,
    }));
  }

  if (mode === 'block') {
    const columns = getBlockColumns(quantity);
    const rows = getBlockRows(quantity, columns);
    const widthFt = Math.max(values.blockWidthFt ?? columns - 1, 0.125);
    const depthFt = Math.max(values.blockDepthFt ?? rows - 1, 0.125);
    const xStep = columns > 1 ? widthFt / (columns - 1) : 0;
    const yStep = rows > 1 ? depthFt / (rows - 1) : 0;

    return Array.from({ length: quantity }, (_, index) => ({
      x: columns === 1 ? 0 : -widthFt / 2 + xStep * (index % columns),
      y: rows === 1 ? 0 : -depthFt / 2 + yStep * Math.floor(index / columns),
    }));
  }

  if (mode === 'cluster') {
    const radiusFt = Math.max(values.clusterRadiusFt ?? 1, 0.125);

    return Array.from({ length: quantity }, (_, index) => {
      const angle = (Math.PI * 2 * index) / quantity - Math.PI / 2;

      return {
        x: quantity === 1 ? 0 : Math.cos(angle) * radiusFt,
        y: quantity === 1 ? 0 : Math.sin(angle) * radiusFt,
      };
    });
  }

  return [{ x: 0, y: 0 }];
}

function average(values: number[]) {
  return values.reduce((total, value) => total + value, 0) / values.length;
}

function maxDistance(values: number[]) {
  return Math.max(...values) - Math.min(...values);
}
