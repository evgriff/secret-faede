import { useEffect, useId, useState } from 'react';

import type {
  CropProfile,
  PlantingMode,
} from '../../domain/gardens/GardenRepository';
import type { PlanWarning } from './gardenPlanning';
import {
  buildArrangementWarnings,
  formatArrangementMetric,
  formatArrangementMode,
  getBlockColumns,
  getBlockRows,
  getEffectiveSpacingFt,
  getFallbackArrangementDefaults,
  getPreviewPoints,
  getSpacingLabel,
  type ArrangementEditorValues,
} from './plantingArrangementEditorModel';
import {
  coercePlantQuantity,
  formatFeetInput,
  getPlantingArrangementDefaults,
  getRecommendedPlantingMode,
} from './cropPickerHelpers';
import styles from './PlantingArrangementEditor.module.css';

export interface PlantingArrangementChange {
  blockDepthFt?: number | null;
  blockWidthFt?: number | null;
  clusterRadiusFt?: number | null;
  mode?: PlantingMode;
  plantCount?: number;
  rowLengthFt?: number | null;
}

export function PlantingArrangementEditor({
  crop,
  mode,
  onChange,
  planWarnings = [],
  plantCount,
  showQuantity = false,
  values,
}: {
  crop: CropProfile | null;
  mode: PlantingMode;
  onChange(values: PlantingArrangementChange): void;
  planWarnings?: PlanWarning[];
  plantCount: number;
  showQuantity?: boolean;
  values: ArrangementEditorValues;
}) {
  const spacingLabelId = useId();
  const quantity = coercePlantQuantity(plantCount);
  const [quantityDraft, setQuantityDraft] = useState(String(quantity));
  const supportedModes = crop?.supportedPlantingModes ?? [mode];
  const recommendedMode = crop
    ? getRecommendedPlantingMode(crop, quantity)
    : mode;
  const defaults = crop
    ? getPlantingArrangementDefaults(crop, mode, quantity)
    : getFallbackArrangementDefaults(mode, quantity);
  const effectiveValues = {
    blockDepthFt: values.blockDepthFt ?? defaults.blockDepthFt,
    blockWidthFt: values.blockWidthFt ?? defaults.blockWidthFt,
    clusterRadiusFt: values.clusterRadiusFt ?? defaults.clusterRadiusFt,
    rowLengthFt: values.rowLengthFt ?? defaults.rowLengthFt,
  };
  const spacingFt = getEffectiveSpacingFt(mode, quantity, effectiveValues);
  const warnings = buildArrangementWarnings({
    crop,
    mode,
    planWarnings,
    quantity,
    recommendedMode,
    spacingFt,
  });
  const previewPoints = getPreviewPoints(mode, quantity, effectiveValues);
  const spacingLabel = getSpacingLabel(mode);

  useEffect(() => {
    setQuantityDraft(String(quantity));
  }, [quantity]);

  function applyMode(nextMode: PlantingMode, nextQuantity = quantity) {
    const nextDefaults = crop
      ? getPlantingArrangementDefaults(crop, nextMode, nextQuantity)
      : getFallbackArrangementDefaults(nextMode, nextQuantity);

    onChange({
      blockDepthFt: nextDefaults.blockDepthFt,
      blockWidthFt: nextDefaults.blockWidthFt,
      clusterRadiusFt: nextDefaults.clusterRadiusFt,
      mode: nextMode,
      plantCount: nextQuantity,
      rowLengthFt: nextDefaults.rowLengthFt,
    });
  }

  function applyQuantity(value: string) {
    setQuantityDraft(value);

    if (value.trim() === '') {
      return;
    }

    const nextQuantity = coercePlantQuantity(value);
    const nextMode =
      mode === recommendedMode && crop
        ? getRecommendedPlantingMode(crop, nextQuantity)
        : mode;

    applyMode(nextMode, nextQuantity);
  }

  function applySpacing(value: string) {
    const nextSpacingFt = Math.max(Number(value) || spacingFt, 0.125);
    const columns = getBlockColumns(quantity);
    const rows = getBlockRows(quantity, columns);

    if (mode === 'row' || mode === 'trellisLine') {
      onChange({
        rowLengthFt: Math.max(nextSpacingFt * Math.max(quantity - 1, 1), 0.125),
      });
      return;
    }

    if (mode === 'block') {
      onChange({
        blockDepthFt: Math.max(nextSpacingFt * Math.max(rows - 1, 1), 0.125),
        blockWidthFt: Math.max(nextSpacingFt * Math.max(columns - 1, 1), 0.125),
      });
      return;
    }

    if (mode === 'cluster') {
      onChange({ clusterRadiusFt: nextSpacingFt });
    }
  }

  return (
    <section className={styles.editor} aria-label="Planting arrangement">
      <div className={styles.header}>
        <div>
          <h3>Arrangement</h3>
          <p>Recommended: {formatArrangementMode(recommendedMode, quantity)}</p>
        </div>
        <span className={styles.metric}>
          Will place {quantity} {quantity === 1 ? 'plant' : 'plants'} as one
          group.
        </span>
      </div>

      {showQuantity ? (
        <label className={styles.field}>
          <span>How many plants?</span>
          <input
            inputMode="numeric"
            min="1"
            onChange={(event) => applyQuantity(event.currentTarget.value)}
            onBlur={() => {
              if (quantityDraft.trim() === '') {
                applyQuantity('1');
              }
            }}
            step="1"
            type="number"
            value={quantityDraft}
          />
        </label>
      ) : null}

      <div className={styles.modeGrid}>
        {supportedModes.map((modeOption) => (
          <button
            aria-pressed={mode === modeOption}
            className={styles.modeButton}
            key={modeOption}
            onClick={() => applyMode(modeOption)}
            type="button"
          >
            <span>{formatArrangementMode(modeOption, quantity)}</span>
            {modeOption === recommendedMode ? <small>Recommended</small> : null}
          </button>
        ))}
      </div>

      <div className={styles.preview} aria-hidden="true">
        <svg role="img" viewBox="0 0 100 64">
          {previewPoints.map((point, index) => (
            <rect
              height="7"
              key={`${point.x}-${point.y}-${index}`}
              rx="1.5"
              width="7"
              x={point.x - 3.5}
              y={point.y - 3.5}
            />
          ))}
        </svg>
        <span className={styles.metric}>
          {formatArrangementMetric(mode, quantity, effectiveValues)}
        </span>
      </div>

      {quantity > 1 && mode !== 'single' ? (
        <div className={styles.controls}>
          <div className={styles.field}>
            <span id={spacingLabelId}>{spacingLabel}</span>
            <div className={styles.rangeRow}>
              <input
                aria-labelledby={spacingLabelId}
                max="8"
                min="0.125"
                onChange={(event) => applySpacing(event.currentTarget.value)}
                step="0.001"
                type="range"
                value={spacingFt}
              />
              <input
                aria-label={`${spacingLabel} value`}
                inputMode="decimal"
                min="0.125"
                onChange={(event) => applySpacing(event.currentTarget.value)}
                step="0.001"
                type="number"
                value={formatFeetInput(spacingFt)}
              />
            </div>
          </div>
        </div>
      ) : null}

      {warnings.length > 0 ? (
        <ul className={styles.warningList}>
          {warnings.slice(0, 4).map((warning, index) => (
            <li key={`${warning}-${index}`}>{warning}</li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
