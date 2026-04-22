import { useMemo, useState, type FormEvent } from 'react';

import {
  cropCatalog,
  cropCatalogFilterOptions,
  filterCropCatalog,
  getCropById,
  type CropCatalogFilters,
} from '../../domain/crops/cropCatalog';
import {
  inferPlotType,
  scoreCropSuitability,
} from '../../domain/crops/cropSuitability';
import type {
  Garden,
  PlantingMode,
  SunExposure,
} from '../../domain/gardens/GardenRepository';
import { cropSunRequirementMet, type SunSeason } from './sunShadeEngine';
import styles from '../plan/PlanModal.module.css';
import type { AddPlantingRequest } from './useGarden';
import {
  CropComparePanel,
  CropDetailCard,
  CropResultButton,
  formatSuitabilityLevel,
} from './CropPickerPanels';
import cropStyles from './CropPickerPanels.module.css';
import {
  calculatePlantCount,
  calculateRequestedAreaSqFt,
  formatLabel,
  formatSowMethod,
  parsePositiveNumber,
} from './cropPickerHelpers';
import { PlantingModeControls } from './PlantingModeControls';
import { VirtualCropResultList } from './VirtualCropResultList';

interface AddPlantModalProps {
  garden: Garden;
  onAddPlant(request: AddPlantingRequest): void;
  onClose(): void;
  sunExposureAtPlacement: SunExposure | null;
  sunSeason: SunSeason;
}

type CategoryFilter = NonNullable<CropCatalogFilters['category']>;
type GrowthFormFilter = NonNullable<CropCatalogFilters['growthForm']>;
type SowMethodFilter = NonNullable<CropCatalogFilters['sowMethod']>;
type SunRequirementFilter = NonNullable<CropCatalogFilters['sunRequirement']>;
type WaterNeedsFilter = NonNullable<CropCatalogFilters['waterNeeds']>;

export function AddPlantModal({
  garden,
  onAddPlant,
  onClose,
  sunExposureAtPlacement,
  sunSeason,
}: AddPlantModalProps) {
  const [category, setCategory] = useState<CategoryFilter>('any');
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
        category,
        growthForm,
        query,
        sowMethod,
        sunRequirement,
        waterNeeds,
      }),
    [category, growthForm, query, sowMethod, sunRequirement, waterNeeds],
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
  const requestedAreaSqFt = calculateRequestedAreaSqFt(selectedMode, {
    blockDepthFt,
    blockWidthFt,
    rowLengthFt,
  });
  const suitability = scoreCropSuitability({
    climateProfile: garden.climateProfile,
    crop: selectedCrop,
    mode: selectedMode,
    plantCount,
    plotType: inferPlotType(garden),
    requestedAreaSqFt,
    sunExposureAtPlacement,
  });
  const compareCrops = filteredCrops.slice(0, 3);
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
                  <span>Category</span>
                  <select
                    onChange={(event) =>
                      setCategory(event.currentTarget.value as CategoryFilter)
                    }
                    value={category}
                  >
                    <option value="any">Any</option>
                    {cropCatalogFilterOptions.categories.map((option) => (
                      <option key={option} value={option}>
                        {formatLabel(option)}
                      </option>
                    ))}
                  </select>
                </label>

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

              <VirtualCropResultList
                className={cropStyles.cropResults}
                crops={filteredCrops}
                empty={
                  <p className={cropStyles.emptyResults}>No matching crops.</p>
                }
                itemHeightPx={92}
                renderCrop={(crop) => (
                  <CropResultButton
                    crop={crop}
                    isSelected={crop.id === selectedCrop.id}
                    key={crop.id}
                    onSelect={() => setSelectedCropId(crop.id)}
                    suitabilityLabel={formatSuitabilityLevel(
                      scoreCropSuitability({
                        climateProfile: garden.climateProfile,
                        crop,
                        mode: crop.supportedPlantingModes[0] ?? 'single',
                        plantCount: null,
                        plotType: inferPlotType(garden),
                        requestedAreaSqFt: null,
                        sunExposureAtPlacement,
                      }),
                    )}
                  />
                )}
              />
            </div>

            <div className={styles.cropDetailPanel}>
              <CropDetailCard
                crop={selectedCrop}
                suitability={suitability}
                sunWarning={sunWarning}
              />

              <CropComparePanel
                crops={compareCrops}
                onSelect={setSelectedCropId}
                selectedCropId={selectedCrop.id}
              />

              <PlantingModeControls
                blockDepthFt={blockDepthFt}
                blockWidthFt={blockWidthFt}
                onBlockDepthChange={setBlockDepthFt}
                onBlockWidthChange={setBlockWidthFt}
                onModeChange={setMode}
                onQuantityChange={setQuantity}
                onRowLengthChange={setRowLengthFt}
                plantCount={plantCount}
                quantity={quantity}
                rowLengthFt={rowLengthFt}
                selectedCrop={selectedCrop}
                selectedMode={selectedMode}
              />
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
