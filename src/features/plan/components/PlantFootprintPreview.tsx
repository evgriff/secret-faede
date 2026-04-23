import { useMemo } from 'react';

import type {
  CropProfile,
  PlantingMode,
} from '../../../domain/gardens/GardenRepository';
import { derivePlantingGeometry } from '../../../domain/gardens/plantingGeometry';
import {
  coercePlantQuantity,
  formatFeetInput,
  getCropIconTone,
  modeLabels,
} from '../../garden/cropPickerHelpers';
import styles from './PlantFootprintPreview.module.css';

export interface PlantFootprintPreviewModel {
  areaLabel: string;
  dots: Array<{ id: string; x: number; y: number }>;
  metricLabel: string;
  modeLabel: string;
  spacingLabel: string;
}

export function PlantFootprintPreview({
  className,
  compact = false,
  crop,
  mode,
  modeOptions = crop.supportedPlantingModes,
  onModeChange,
  quantity,
  spacingOverrideInches = null,
}: {
  className?: string;
  compact?: boolean;
  crop: CropProfile;
  mode: PlantingMode;
  modeOptions?: PlantingMode[];
  onModeChange?: (mode: PlantingMode) => void;
  quantity: number;
  spacingOverrideInches?: number | null;
}) {
  const preview = useMemo(
    () =>
      buildPlantFootprintPreview({
        crop,
        mode,
        quantity,
        spacingOverrideInches,
      }),
    [crop, mode, quantity, spacingOverrideInches],
  );
  const classNames = [
    styles.preview,
    compact ? styles.compact : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <section
      aria-label={`${crop.commonName} footprint preview`}
      className={classNames}
      data-crop-tone={getCropIconTone(crop)}
    >
      <div className={styles.previewHeader}>
        <strong>Footprint preview</strong>
        <span>
          {coercePlantQuantity(quantity)}{' '}
          {coercePlantQuantity(quantity) === 1 ? 'plant' : 'plants'}
        </span>
      </div>
      <div className={styles.previewBody}>
        <svg
          aria-label={`${crop.commonName} ${preview.modeLabel.toLowerCase()} footprint, ${preview.metricLabel}`}
          className={styles.footprintGraphic}
          role="img"
          viewBox="0 0 120 72"
        >
          <rect
            className={styles.footprintOutline}
            height="58"
            rx="7"
            width="106"
            x="7"
            y="7"
          />
          {preview.dots.map((dot, index) => (
            <circle
              className={`${styles.footprintDot} ${
                index % 4 === 0 ? styles.footprintDotAlt : ''
              }`}
              cx={dot.x}
              cy={dot.y}
              key={dot.id}
              r="3.35"
            />
          ))}
        </svg>
        <dl className={styles.footprintMetric}>
          <div>
            <dt>Form</dt>
            <dd>{preview.modeLabel}</dd>
          </div>
          <div>
            <dt>Space</dt>
            <dd>{preview.metricLabel}</dd>
          </div>
          <div>
            <dt>Area</dt>
            <dd>{preview.areaLabel}</dd>
          </div>
          <div>
            <dt>Spacing</dt>
            <dd>{preview.spacingLabel}</dd>
          </div>
        </dl>
      </div>
      {onModeChange ? (
        <div
          aria-label={`${crop.commonName} planting form`}
          className={styles.modeControls}
          role="group"
        >
          {modeOptions.map((modeOption) => (
            <button
              aria-pressed={mode === modeOption}
              className={styles.modeButton}
              key={modeOption}
              onClick={() => onModeChange(modeOption)}
              type="button"
            >
              {modeLabels[modeOption]}
            </button>
          ))}
        </div>
      ) : null}
    </section>
  );
}

export function buildPlantFootprintPreview({
  crop,
  mode,
  quantity,
  spacingOverrideInches = null,
}: {
  crop: CropProfile;
  mode: PlantingMode;
  quantity: number;
  spacingOverrideInches?: number | null;
}): PlantFootprintPreviewModel {
  const spacingInches =
    spacingOverrideInches ??
    crop.spacingInches ??
    crop.matureSpreadInches ??
    12;
  const geometry = derivePlantingGeometry({
    matureSpreadInches: crop.matureSpreadInches,
    mode,
    quantity: coercePlantQuantity(quantity),
    rowSpacingInches: crop.rowSpacingInches,
    spacingInches,
    xFt: 0,
    yFt: 0,
  });
  const widthFt = geometry.footprint.widthFt;
  const depthFt = geometry.footprint.depthFt;
  const dots = geometry.dots.map((dot) => ({
    id: `${dot.index}-${dot.offsetXFt}-${dot.offsetYFt}`,
    x: 7 + scaleToViewBox(dot.xFt, geometry.footprint.xFt, widthFt, 106),
    y: 7 + scaleToViewBox(dot.yFt, geometry.footprint.yFt, depthFt, 58),
  }));

  return {
    areaLabel: `${formatPreviewNumber(widthFt * depthFt)} sq ft`,
    dots,
    metricLabel: formatFootprintMetric(mode, widthFt, depthFt),
    modeLabel: modeLabels[mode],
    spacingLabel: `${formatFeetInput(geometry.spacingFt)} ft centers`,
  };
}

function formatFootprintMetric(
  mode: PlantingMode,
  widthFt: number,
  depthFt: number,
) {
  if (mode === 'row' || mode === 'trellisLine') {
    return `${formatFeetInput(widthFt)} ft line`;
  }

  if (mode === 'cluster') {
    return `${formatFeetInput(Math.max(widthFt, depthFt) / 2)} ft radius`;
  }

  return `${formatFeetInput(widthFt)} x ${formatFeetInput(depthFt)} ft`;
}

function scaleToViewBox(
  valueFt: number,
  startFt: number,
  dimensionFt: number,
  viewDimension: number,
) {
  if (!Number.isFinite(dimensionFt) || dimensionFt <= 0) {
    return viewDimension / 2;
  }

  return ((valueFt - startFt) / dimensionFt) * viewDimension;
}

function formatPreviewNumber(value: number) {
  return Number(value.toFixed(1)).toString();
}
