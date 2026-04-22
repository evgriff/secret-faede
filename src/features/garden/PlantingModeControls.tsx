import type {
  CropProfile,
  PlantingMode,
} from '../../domain/gardens/GardenRepository';
import { modeLabels } from './cropPickerHelpers';
import cropStyles from './CropPickerPanels.module.css';
import styles from '../plan/PlanModal.module.css';

export function PlantingModeControls({
  blockDepthFt,
  blockWidthFt,
  onBlockDepthChange,
  onBlockWidthChange,
  onModeChange,
  onQuantityChange,
  onRowLengthChange,
  plantCount,
  quantity,
  rowLengthFt,
  selectedCrop,
  selectedMode,
}: {
  blockDepthFt: string;
  blockWidthFt: string;
  onBlockDepthChange(value: string): void;
  onBlockWidthChange(value: string): void;
  onModeChange(mode: PlantingMode): void;
  onQuantityChange(value: string): void;
  onRowLengthChange(value: string): void;
  plantCount: number | null;
  quantity: string;
  rowLengthFt: string;
  selectedCrop: CropProfile;
  selectedMode: PlantingMode;
}) {
  return (
    <>
      <fieldset className={cropStyles.modeFieldset}>
        <legend>Planting mode</legend>
        <div className={cropStyles.modeGrid}>
          {selectedCrop.supportedPlantingModes.map((modeOption) => (
            <button
              aria-pressed={selectedMode === modeOption}
              className={`${cropStyles.modeButton} ${
                selectedMode === modeOption ? cropStyles.selectedModeButton : ''
              }`}
              key={modeOption}
              onClick={() => onModeChange(modeOption)}
              type="button"
            >
              {modeLabels[modeOption]}
            </button>
          ))}
        </div>
      </fieldset>

      <div className={cropStyles.plantingControls}>
        {selectedMode === 'row' || selectedMode === 'trellisLine' ? (
          <NumberField
            label="Row length in feet"
            onChange={onRowLengthChange}
            value={rowLengthFt}
          />
        ) : null}

        {selectedMode === 'block' ? (
          <div className={styles.filterGrid}>
            <NumberField
              label="Block width in feet"
              onChange={onBlockWidthChange}
              value={blockWidthFt}
            />
            <NumberField
              label="Block depth in feet"
              onChange={onBlockDepthChange}
              value={blockDepthFt}
            />
          </div>
        ) : null}

        {selectedMode === 'single' || selectedMode === 'cluster' ? (
          <NumberField
            inputMode="numeric"
            label="Quantity"
            onChange={onQuantityChange}
            step="1"
            value={quantity}
          />
        ) : null}

        <p className={cropStyles.cropEstimate}>
          Planned count: {plantCount ?? 1}
        </p>
      </div>
    </>
  );
}

function NumberField({
  inputMode = 'decimal',
  label,
  onChange,
  step = '0.5',
  value,
}: {
  inputMode?: 'decimal' | 'numeric';
  label: string;
  onChange(value: string): void;
  step?: string;
  value: string;
}) {
  return (
    <label className={styles.field}>
      <span>{label}</span>
      <input
        inputMode={inputMode}
        min="1"
        onChange={(event) => onChange(event.currentTarget.value)}
        step={step}
        type="number"
        value={value}
      />
    </label>
  );
}
