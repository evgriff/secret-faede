import { useMemo, useState, type FormEvent } from 'react';

import {
  cropCatalog,
  cropCatalogFilterOptions,
  filterCropCatalog,
  getCropById,
  type CropCatalogFilters,
} from '../../domain/crops/cropCatalog';
import type {
  CropProfile,
  CropWaterNeed,
  PlantingMode,
  SunExposure,
} from '../../domain/gardens/GardenRepository';
import { cropSunRequirementMet, type SunSeason } from './sunShadeEngine';
import styles from './GardenEditorScreen.module.css';
import type { AddPlantingRequest } from './useGarden';

interface AddPlantModalProps {
  onAddPlant(request: AddPlantingRequest): void;
  onClose(): void;
  sunExposureAtPlacement: SunExposure | null;
  sunSeason: SunSeason;
}

const modeLabels: Record<PlantingMode, string> = {
  block: 'Block',
  cluster: 'Cluster',
  row: 'Row',
  single: 'Single',
  trellisLine: 'Trellis',
};

type GrowthFormFilter = NonNullable<CropCatalogFilters['growthForm']>;
type SowMethodFilter = NonNullable<CropCatalogFilters['sowMethod']>;
type SunRequirementFilter = NonNullable<CropCatalogFilters['sunRequirement']>;
type WaterNeedsFilter = NonNullable<CropCatalogFilters['waterNeeds']>;

export function AddPlantModal({
  onAddPlant,
  onClose,
  sunExposureAtPlacement,
  sunSeason,
}: AddPlantModalProps) {
  const [growthForm, setGrowthForm] = useState<GrowthFormFilter>('any');
  const [mode, setMode] = useState<PlantingMode>('single');
  const [query, setQuery] = useState('');
  const [selectedCropId, setSelectedCropId] = useState(getDefaultCrop().id);
  const [sowMethod, setSowMethod] = useState<SowMethodFilter>('any');
  const [sunRequirement, setSunRequirement] =
    useState<SunRequirementFilter>('any');
  const [waterNeeds, setWaterNeeds] = useState<WaterNeedsFilter>('any');
  const [quantity, setQuantity] = useState('1');
  const [rowLengthFt, setRowLengthFt] = useState('6');
  const [blockWidthFt, setBlockWidthFt] = useState('4');
  const [blockDepthFt, setBlockDepthFt] = useState('3');

  const filteredCrops = useMemo(
    () =>
      filterCropCatalog({
        growthForm,
        query,
        sowMethod,
        sunRequirement,
        waterNeeds,
      }).slice(0, 12),
    [growthForm, query, sowMethod, sunRequirement, waterNeeds],
  );
  const selectedCrop =
    filteredCrops.find((crop) => crop.id === selectedCropId) ??
    filteredCrops[0] ??
    getCropById(selectedCropId) ??
    getDefaultCrop();
  const selectedMode = selectedCrop.supportedPlantingModes.includes(mode)
    ? mode
    : (selectedCrop.supportedPlantingModes[0] ?? 'single');
  const plantCount = calculatePlantCount(selectedCrop, selectedMode, {
    blockDepthFt,
    blockWidthFt,
    quantity,
    rowLengthFt,
  });
  const sunWarning =
    sunExposureAtPlacement &&
    !cropSunRequirementMet(selectedCrop.sunRequirement, sunExposureAtPlacement)
      ? `${selectedCrop.commonName} prefers ${formatLabel(
          selectedCrop.sunRequirement,
        )}; the next placement area is ${formatLabel(
          sunExposureAtPlacement,
        )} in ${formatLabel(sunSeason)}.`
      : null;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onAddPlant({
      blockDepthFt:
        selectedMode === 'block' ? parsePositiveNumber(blockDepthFt, 3) : null,
      blockWidthFt:
        selectedMode === 'block' ? parsePositiveNumber(blockWidthFt, 4) : null,
      crop: selectedCrop,
      mode: selectedMode,
      plantCount,
      rowLengthFt:
        selectedMode === 'row' || selectedMode === 'trellisLine'
          ? parsePositiveNumber(rowLengthFt, 6)
          : null,
    });
  }

  return (
    <div className={styles.modalBackdrop}>
      <section
        aria-labelledby="add-plant-title"
        aria-modal="true"
        className={`${styles.modal} ${styles.cropModal}`}
        role="dialog"
      >
        <div className={styles.modalHeader}>
          <h2 id="add-plant-title">Add Plant</h2>
          <button
            aria-label="Close"
            className={styles.iconButton}
            onClick={onClose}
            type="button"
          >
            x
          </button>
        </div>

        <form className={styles.cropPickerForm} onSubmit={handleSubmit}>
          <div className={styles.cropPickerLayout}>
            <div className={styles.cropSearchPanel}>
              <label className={styles.field}>
                <span>Search crops</span>
                <input
                  autoFocus
                  onChange={(event) => setQuery(event.currentTarget.value)}
                  type="search"
                  value={query}
                />
              </label>

              <div className={styles.filterGrid}>
                <label className={styles.field}>
                  <span>Sun</span>
                  <select
                    onChange={(event) =>
                      setSunRequirement(
                        event.currentTarget.value as SunRequirementFilter,
                      )
                    }
                    value={sunRequirement}
                  >
                    <option value="any">Any</option>
                    {cropCatalogFilterOptions.sunRequirements.map((option) => (
                      <option key={option} value={option}>
                        {formatLabel(option)}
                      </option>
                    ))}
                  </select>
                </label>

                <label className={styles.field}>
                  <span>Water</span>
                  <select
                    onChange={(event) =>
                      setWaterNeeds(
                        event.currentTarget.value as WaterNeedsFilter,
                      )
                    }
                    value={waterNeeds}
                  >
                    <option value="any">Any</option>
                    {cropCatalogFilterOptions.waterNeeds.map((option) => (
                      <option key={option} value={option}>
                        {formatLabel(option)}
                      </option>
                    ))}
                  </select>
                </label>

                <label className={styles.field}>
                  <span>Form</span>
                  <select
                    onChange={(event) =>
                      setGrowthForm(
                        event.currentTarget.value as GrowthFormFilter,
                      )
                    }
                    value={growthForm}
                  >
                    <option value="any">Any</option>
                    {cropCatalogFilterOptions.growthForms.map((option) => (
                      <option key={option} value={option}>
                        {formatLabel(option)}
                      </option>
                    ))}
                  </select>
                </label>

                <label className={styles.field}>
                  <span>Sow</span>
                  <select
                    onChange={(event) =>
                      setSowMethod(event.currentTarget.value as SowMethodFilter)
                    }
                    value={sowMethod}
                  >
                    <option value="any">Any</option>
                    {cropCatalogFilterOptions.sowMethods.map((option) => (
                      <option key={option} value={option}>
                        {formatSowMethod(option)}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className={styles.cropResults}>
                {filteredCrops.length > 0 ? (
                  filteredCrops.map((crop) => (
                    <button
                      aria-label={`${crop.commonName} crop`}
                      aria-pressed={crop.id === selectedCrop.id}
                      className={`${styles.cropOption} ${
                        crop.id === selectedCrop.id
                          ? styles.selectedCropOption
                          : ''
                      }`}
                      key={crop.id}
                      onClick={() => setSelectedCropId(crop.id)}
                      type="button"
                    >
                      <span className={styles.cropGlyph} aria-hidden="true">
                        {formatGlyph(crop)}
                      </span>
                      <span>
                        <strong>{crop.commonName}</strong>
                        <small>{crop.family}</small>
                      </span>
                    </button>
                  ))
                ) : (
                  <p className={styles.emptyResults}>No matching crops.</p>
                )}
              </div>
            </div>

            <div className={styles.cropDetailPanel}>
              <article className={styles.cropCard}>
                <div className={styles.cropCardHeader}>
                  <span className={styles.cropBadge} aria-hidden="true">
                    {formatGlyph(selectedCrop)}
                  </span>
                  <div>
                    <h3>{selectedCrop.commonName}</h3>
                    <p>{selectedCrop.scientificName}</p>
                  </div>
                </div>
                <dl className={styles.cropStats}>
                  <div>
                    <dt>Sun</dt>
                    <dd>{formatLabel(selectedCrop.sunRequirement)}</dd>
                  </div>
                  <div>
                    <dt>Water</dt>
                    <dd>{formatWater(selectedCrop.waterNeeds)}</dd>
                  </div>
                  <div>
                    <dt>Spacing</dt>
                    <dd>{selectedCrop.spacingInches ?? '-'} in</dd>
                  </div>
                  <div>
                    <dt>Maturity</dt>
                    <dd>{selectedCrop.daysToMaturity ?? '-'} days</dd>
                  </div>
                </dl>
                <p className={styles.cropNotes}>{selectedCrop.notes}</p>
                {sunWarning ? (
                  <p className={styles.warningText}>{sunWarning}</p>
                ) : null}
              </article>

              <fieldset className={styles.modeFieldset}>
                <legend>Planting mode</legend>
                <div className={styles.modeGrid}>
                  {selectedCrop.supportedPlantingModes.map((modeOption) => (
                    <button
                      aria-pressed={selectedMode === modeOption}
                      className={`${styles.modeButton} ${
                        selectedMode === modeOption
                          ? styles.selectedModeButton
                          : ''
                      }`}
                      key={modeOption}
                      onClick={() => setMode(modeOption)}
                      type="button"
                    >
                      {modeLabels[modeOption]}
                    </button>
                  ))}
                </div>
              </fieldset>

              <div className={styles.plantingControls}>
                {selectedMode === 'row' || selectedMode === 'trellisLine' ? (
                  <label className={styles.field}>
                    <span>Row length in feet</span>
                    <input
                      inputMode="decimal"
                      min="1"
                      onChange={(event) =>
                        setRowLengthFt(event.currentTarget.value)
                      }
                      step="0.5"
                      type="number"
                      value={rowLengthFt}
                    />
                  </label>
                ) : null}

                {selectedMode === 'block' ? (
                  <div className={styles.filterGrid}>
                    <label className={styles.field}>
                      <span>Block width in feet</span>
                      <input
                        inputMode="decimal"
                        min="1"
                        onChange={(event) =>
                          setBlockWidthFt(event.currentTarget.value)
                        }
                        step="0.5"
                        type="number"
                        value={blockWidthFt}
                      />
                    </label>
                    <label className={styles.field}>
                      <span>Block depth in feet</span>
                      <input
                        inputMode="decimal"
                        min="1"
                        onChange={(event) =>
                          setBlockDepthFt(event.currentTarget.value)
                        }
                        step="0.5"
                        type="number"
                        value={blockDepthFt}
                      />
                    </label>
                  </div>
                ) : null}

                {selectedMode === 'single' || selectedMode === 'cluster' ? (
                  <label className={styles.field}>
                    <span>Quantity</span>
                    <input
                      inputMode="numeric"
                      min="1"
                      onChange={(event) =>
                        setQuantity(event.currentTarget.value)
                      }
                      step="1"
                      type="number"
                      value={quantity}
                    />
                  </label>
                ) : null}

                <p className={styles.cropEstimate}>
                  Planned count: {plantCount ?? 1}
                </p>
              </div>
            </div>
          </div>

          <div className={styles.modalActions}>
            <button
              className={styles.secondaryButton}
              onClick={onClose}
              type="button"
            >
              Cancel
            </button>
            <button className={styles.primaryButton} type="submit">
              Add plant
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

function getDefaultCrop() {
  const crop = cropCatalog[0];

  if (!crop) {
    throw new Error('Crop catalog is empty.');
  }

  return crop;
}

function calculatePlantCount(
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

function parsePositiveNumber(value: string, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function formatGlyph(crop: CropProfile) {
  const source = crop.defaultIcon || crop.commonName;
  return source
    .split(/[-_\s]+/)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

function formatWater(value: CropWaterNeed) {
  return `${formatLabel(value)} water`;
}

function formatSowMethod(value: NonNullable<CropCatalogFilters['sowMethod']>) {
  if (value === 'directSow') {
    return 'Direct sow';
  }

  return formatLabel(value);
}

function formatLabel(value: string) {
  return value
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (letter) => letter.toUpperCase());
}
