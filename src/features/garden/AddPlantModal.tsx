import { useMemo, useState, type FormEvent } from 'react';

import {
  cropCatalog,
  filterCropCatalog,
  getCropById,
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
import {
  CropPickerFilters,
  type CategoryFilter,
  type GrowthFormFilter,
  type SowMethodFilter,
  type SunRequirementFilter,
  type WaterNeedsFilter,
} from './CropPickerFilters';
import cropStyles from './CropPickerPanels.module.css';
import {
  calculatePlantCount,
  calculateRequestedAreaSqFt,
  coercePlantQuantity,
  formatFeetInput,
  formatLabel,
  getPlantingArrangementDefaults,
  getRecommendedPlantingMode,
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
  const [rowLengthFt, setRowLengthFt] = useState('');
  const [blockWidthFt, setBlockWidthFt] = useState('');
  const [blockDepthFt, setBlockDepthFt] = useState('');
  const [clusterRadiusFt, setClusterRadiusFt] = useState('');

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
  const requestedQuantity = coercePlantQuantity(quantity);
  const recommendedMode = getRecommendedPlantingMode(
    selectedCrop,
    requestedQuantity,
  );
  const selectedMode = selectedCrop.supportedPlantingModes.includes(mode)
    ? mode
    : recommendedMode;
  const plantCount = calculatePlantCount(selectedCrop, selectedMode, {
    blockDepthFt,
    blockWidthFt,
    quantity,
    rowLengthFt,
  });
  const arrangementDefaults = getPlantingArrangementDefaults(
    selectedCrop,
    selectedMode,
    plantCount,
  );
  const effectiveBlockDepthFt = parsePositiveNumber(
    blockDepthFt,
    arrangementDefaults.blockDepthFt ?? 1,
  );
  const effectiveBlockWidthFt = parsePositiveNumber(
    blockWidthFt,
    arrangementDefaults.blockWidthFt ?? 1,
  );
  const effectiveRowLengthFt = parsePositiveNumber(
    rowLengthFt,
    arrangementDefaults.rowLengthFt ?? 1,
  );
  const effectiveClusterRadiusFt = parsePositiveNumber(
    clusterRadiusFt,
    arrangementDefaults.clusterRadiusFt ?? 1,
  );
  const requestedAreaSqFt = calculateRequestedAreaSqFt(selectedMode, {
    blockDepthFt: String(effectiveBlockDepthFt),
    blockWidthFt: String(effectiveBlockWidthFt),
    clusterRadiusFt: String(effectiveClusterRadiusFt),
    rowLengthFt: String(effectiveRowLengthFt),
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
      blockDepthFt: selectedMode === 'block' ? effectiveBlockDepthFt : null,
      blockWidthFt: selectedMode === 'block' ? effectiveBlockWidthFt : null,
      clusterRadiusFt:
        selectedMode === 'cluster' ? effectiveClusterRadiusFt : null,
      crop: selectedCrop,
      mode: selectedMode,
      plantCount,
      rowLengthFt:
        selectedMode === 'row' || selectedMode === 'trellisLine'
          ? effectiveRowLengthFt
          : null,
    });
  }

  function handleQuantityChange(value: string) {
    const currentRecommendedMode = getRecommendedPlantingMode(
      selectedCrop,
      requestedQuantity,
    );
    const nextQuantity = coercePlantQuantity(value);
    const nextRecommendedMode = getRecommendedPlantingMode(
      selectedCrop,
      nextQuantity,
    );

    setQuantity(value);
    setMode((currentMode) =>
      currentMode === currentRecommendedMode
        ? nextRecommendedMode
        : currentMode,
    );
    clearCustomArrangement();
  }

  function handleModeChange(nextMode: PlantingMode) {
    setMode(nextMode);
    clearCustomArrangement();
  }

  function handleSelectCrop(cropId: string) {
    const nextCrop = getCropById(cropId);

    setSelectedCropId(cropId);

    if (nextCrop) {
      setMode(getRecommendedPlantingMode(nextCrop, requestedQuantity));
      clearCustomArrangement();
    }
  }

  function clearCustomArrangement() {
    setRowLengthFt('');
    setBlockWidthFt('');
    setBlockDepthFt('');
    setClusterRadiusFt('');
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
              <CropPickerFilters
                category={category}
                growthForm={growthForm}
                onCategoryChange={setCategory}
                onGrowthFormChange={setGrowthForm}
                onQueryChange={setQuery}
                onSowMethodChange={setSowMethod}
                onSunRequirementChange={setSunRequirement}
                onWaterNeedsChange={setWaterNeeds}
                query={query}
                sowMethod={sowMethod}
                sunRequirement={sunRequirement}
                waterNeeds={waterNeeds}
              />

              <VirtualCropResultList
                className={cropStyles.cropResults}
                crops={filteredCrops}
                empty={
                  <p className={cropStyles.emptyResults}>No matching crops.</p>
                }
                itemHeightPx={92}
                renderCrop={(crop) => {
                  const cropMode = getRecommendedPlantingMode(crop, plantCount);
                  const cropArrangement = getPlantingArrangementDefaults(
                    crop,
                    cropMode,
                    plantCount,
                  );

                  return (
                    <CropResultButton
                      crop={crop}
                      isSelected={crop.id === selectedCrop.id}
                      key={crop.id}
                      onSelect={() => handleSelectCrop(crop.id)}
                      suitabilityLabel={formatSuitabilityLevel(
                        scoreCropSuitability({
                          climateProfile: garden.climateProfile,
                          crop,
                          mode: cropMode,
                          plantCount,
                          plotType: inferPlotType(garden),
                          requestedAreaSqFt: cropArrangement.requestedAreaSqFt,
                          sunExposureAtPlacement,
                        }),
                      )}
                    />
                  );
                }}
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
                onSelect={handleSelectCrop}
                selectedCropId={selectedCrop.id}
              />

              <PlantingModeControls
                blockDepthFt={blockDepthFt}
                blockDepthPlaceholder={formatFeetInput(
                  arrangementDefaults.blockDepthFt,
                )}
                blockWidthFt={blockWidthFt}
                blockWidthPlaceholder={formatFeetInput(
                  arrangementDefaults.blockWidthFt,
                )}
                clusterRadiusFt={clusterRadiusFt}
                clusterRadiusPlaceholder={formatFeetInput(
                  arrangementDefaults.clusterRadiusFt,
                )}
                onBlockDepthChange={setBlockDepthFt}
                onBlockWidthChange={setBlockWidthFt}
                onClusterRadiusChange={setClusterRadiusFt}
                onModeChange={handleModeChange}
                onQuantityChange={handleQuantityChange}
                onRowLengthChange={setRowLengthFt}
                plantCount={plantCount}
                rowLengthFt={rowLengthFt}
                rowLengthPlaceholder={formatFeetInput(
                  arrangementDefaults.rowLengthFt,
                )}
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
