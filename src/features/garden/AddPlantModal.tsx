import { useEffect, useMemo, useState, type FormEvent } from 'react';

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
import { Button, Modal } from '../shared/design/DesignPrimitives';
import { cropSunRequirementMet, type SunSeason } from './sunShadeEngine';
import styles from '../plan/PlanModal.module.css';
import type { AddPlantingRequest } from './useGarden';
import {
  CropComparePanel,
  CropDetailCard,
  CropResultButton,
} from './CropPickerPanels';
import {
  CropPickerFilters,
  type CategoryFilter,
  type GrowthFormFilter,
  type LocationFilter,
  type SowMethodFilter,
  type SunRequirementFilter,
  type TimingFilter,
  type WaterNeedsFilter,
} from './CropPickerFilters';
import cropStyles from './CropPickerPanels.module.css';
import { buildAddPlantRequest } from './addPlantRequest';
import {
  calculatePlantCount,
  calculateRequestedAreaSqFt,
  compareCropPickerResults,
  coercePlantQuantity,
  formatFeetInput,
  formatLabel,
  formatLocationSource,
  getPlantingArrangementDefaults,
  getRecommendedPlantingMode,
  isLocationFit,
  parsePositiveNumber,
  type RankedCropPickerResult,
} from './cropPickerHelpers';
import { PlantingModeControls } from './PlantingModeControls';
import { VirtualCropResultList } from './VirtualCropResultList';

interface AddPlantModalProps {
  garden: Garden;
  onAddPlant(request: AddPlantingRequest): void;
  onClose(): void;
  onPreviewChange?: (request: AddPlantingRequest | null) => void;
  sunExposureAtPlacement: SunExposure | null;
  sunSeason: SunSeason;
}

const CROP_RESULT_ROW_HEIGHT_PX = 116;

export function AddPlantModal({
  garden,
  onAddPlant,
  onClose,
  onPreviewChange,
  sunExposureAtPlacement,
  sunSeason,
}: AddPlantModalProps) {
  const [category, setCategory] = useState<CategoryFilter>('any');
  const [growthForm, setGrowthForm] = useState<GrowthFormFilter>('any');
  const [locationFilter, setLocationFilter] = useState<LocationFilter>('any');
  const [mode, setMode] = useState<PlantingMode>('single');
  const [query, setQuery] = useState('');
  const [selectedCropId, setSelectedCropId] = useState(getDefaultCrop().id);
  const [sowMethod, setSowMethod] = useState<SowMethodFilter>('any');
  const [sunRequirement, setSunRequirement] =
    useState<SunRequirementFilter>('any');
  const [timingFilter, setTimingFilter] = useState<TimingFilter>('any');
  const [waterNeeds, setWaterNeeds] = useState<WaterNeedsFilter>('any');
  const [quantity, setQuantity] = useState('1');
  const [rowLengthFt, setRowLengthFt] = useState('');
  const [blockWidthFt, setBlockWidthFt] = useState('');
  const [blockDepthFt, setBlockDepthFt] = useState('');
  const [clusterRadiusFt, setClusterRadiusFt] = useState('');

  const catalogMatches = useMemo(
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
  const requestedQuantity = coercePlantQuantity(quantity);
  const rankedCrops = useMemo<RankedCropPickerResult[]>(
    () =>
      catalogMatches
        .map((crop, baseOrder) => {
          const cropMode = getRecommendedPlantingMode(crop, requestedQuantity);
          const cropArrangement = getPlantingArrangementDefaults(
            crop,
            cropMode,
            requestedQuantity,
          );

          return {
            baseOrder,
            crop,
            suitability: scoreCropSuitability({
              climateProfile: garden.climateProfile,
              crop,
              location: garden.plot.location,
              mode: cropMode,
              plantCount: requestedQuantity,
              plotType: inferPlotType(garden),
              requestedAreaSqFt: cropArrangement.requestedAreaSqFt,
              sunExposureAtPlacement,
            }),
          };
        })
        .filter(
          (entry) =>
            isLocationFit(entry.suitability, locationFilter) &&
            (timingFilter === 'any' ||
              entry.suitability.timing.status === timingFilter),
        )
        .sort((left, right) =>
          compareCropPickerResults(left, right, {
            query,
          }),
        ),
    [
      catalogMatches,
      garden,
      locationFilter,
      query,
      requestedQuantity,
      sunExposureAtPlacement,
      timingFilter,
    ],
  );
  const selectedCropResult =
    rankedCrops.find((entry) => entry.crop.id === selectedCropId) ??
    rankedCrops[0] ??
    null;
  const selectedCrop =
    selectedCropResult?.crop ?? getCropById(selectedCropId) ?? getDefaultCrop();
  const rankedCropProfiles = useMemo(
    () => rankedCrops.map((entry) => entry.crop),
    [rankedCrops],
  );
  const rankedCropResultsById = useMemo(
    () => new Map(rankedCrops.map((entry) => [entry.crop.id, entry])),
    [rankedCrops],
  );
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
    location: garden.plot.location,
    mode: selectedMode,
    plantCount,
    plotType: inferPlotType(garden),
    requestedAreaSqFt,
    sunExposureAtPlacement,
  });
  const compareCrops = rankedCrops.slice(0, 3).map((entry) => entry.crop);
  const locationHelperText = formatLocationSource(suitability);
  const sunWarning =
    sunExposureAtPlacement &&
    !cropSunRequirementMet(selectedCrop.sunRequirement, sunExposureAtPlacement)
      ? `${selectedCrop.commonName} prefers ${formatLabel(
          selectedCrop.sunRequirement,
        )}; the next placement area is ${formatLabel(
          sunExposureAtPlacement,
        )} in ${formatLabel(sunSeason)}.`
      : null;
  useEffect(() => {
    if (rankedCrops.length === 0) {
      onPreviewChange?.(null);
      return;
    }

    onPreviewChange?.(
      buildAddPlantRequest({
        crop: selectedCrop,
        effectiveBlockDepthFt,
        effectiveBlockWidthFt,
        effectiveClusterRadiusFt,
        effectiveRowLengthFt,
        plantCount,
        selectedMode,
      }),
    );

    return () => onPreviewChange?.(null);
  }, [
    effectiveBlockDepthFt,
    effectiveBlockWidthFt,
    effectiveClusterRadiusFt,
    effectiveRowLengthFt,
    onPreviewChange,
    plantCount,
    rankedCrops.length,
    selectedCrop,
    selectedMode,
  ]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (rankedCrops.length === 0) {
      return;
    }

    onAddPlant(
      buildAddPlantRequest({
        crop: selectedCrop,
        effectiveBlockDepthFt,
        effectiveBlockWidthFt,
        effectiveClusterRadiusFt,
        effectiveRowLengthFt,
        plantCount,
        selectedMode,
      }),
    );
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
    <Modal
      bodyClassName={styles.cropModalBody}
      className={styles.cropModal}
      closeLabel="Close crop picker"
      description="Pick a crop that fits this garden and the current planting window."
      footer={
        <>
          <Button onClick={onClose} tone="secondary" type="button">
            Cancel
          </Button>
          <Button
            disabled={rankedCrops.length === 0}
            form="add-plant-form"
            tone="primary"
            type="submit"
          >
            Add plant
          </Button>
        </>
      }
      mobilePresentation="fullScreen"
      onClose={onClose}
      title="Add Plant"
    >
      <form
        className={styles.cropPickerForm}
        id="add-plant-form"
        onSubmit={handleSubmit}
      >
        <div className={styles.cropPickerLayout}>
          <div className={styles.cropSearchPanel}>
            <div className={styles.cropFiltersPanel}>
              <CropPickerFilters
                category={category}
                growthForm={growthForm}
                locationFilter={locationFilter}
                locationHelperText={locationHelperText}
                onCategoryChange={setCategory}
                onGrowthFormChange={setGrowthForm}
                onLocationFilterChange={setLocationFilter}
                onQueryChange={setQuery}
                onSowMethodChange={setSowMethod}
                onSunRequirementChange={setSunRequirement}
                onTimingFilterChange={setTimingFilter}
                onWaterNeedsChange={setWaterNeeds}
                query={query}
                sowMethod={sowMethod}
                sunRequirement={sunRequirement}
                timingFilter={timingFilter}
                waterNeeds={waterNeeds}
              />
            </div>

            <div className={styles.cropResultsPanel}>
              <VirtualCropResultList
                className={cropStyles.cropResults}
                crops={rankedCropProfiles}
                empty={
                  <p className={cropStyles.emptyResults}>
                    No crops match these garden-fit filters.
                  </p>
                }
                itemHeightPx={CROP_RESULT_ROW_HEIGHT_PX}
                renderCrop={(crop) => {
                  const cropResult = rankedCropResultsById.get(crop.id);

                  return (
                    <CropResultButton
                      crop={crop}
                      fitHeadline={
                        cropResult?.suitability.locationHeadline ??
                        suitability.locationHeadline
                      }
                      isSelected={crop.id === selectedCrop.id}
                      key={crop.id}
                      onSelect={() => handleSelectCrop(crop.id)}
                      timingLabel={
                        cropResult?.suitability.timing.label ??
                        suitability.timing.label
                      }
                    />
                  );
                }}
              />
            </div>
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
      </form>
    </Modal>
  );
}

function getDefaultCrop() {
  const crop = cropCatalog[0];

  if (!crop) {
    throw new Error('Crop catalog is empty.');
  }

  return crop;
}
