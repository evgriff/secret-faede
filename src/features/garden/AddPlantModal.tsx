import type {
  Garden,
  SunExposure,
} from '../../domain/gardens/GardenRepository';
import { Button, Modal } from '../shared/design/DesignPrimitives';
import type { SunSeason } from './sunShadeEngine';
import styles from '../plan/PlanModal.module.css';
import type { AddPlantingRequest } from './useGarden';
import {
  CropComparePanel,
  CropDetailCard,
  CropResultButton,
} from './CropPickerPanels';
import { CropPickerFilters } from './CropPickerFilters';
import cropStyles from './CropPickerPanels.module.css';
import { formatFeetInput } from './cropPickerHelpers';
import { PlantingModeControls } from './PlantingModeControls';
import {
  CROP_RESULT_ROW_HEIGHT_PX,
  useAddPlantModalState,
} from './useAddPlantModalState';
import { VirtualCropResultList } from './VirtualCropResultList';

interface AddPlantModalProps {
  garden: Garden;
  onAddPlant(request: AddPlantingRequest): void;
  onClose(): void;
  onPreviewChange?: (request: AddPlantingRequest | null) => void;
  sunExposureAtPlacement: SunExposure | null;
  sunSeason: SunSeason;
}

export function AddPlantModal({
  garden,
  onAddPlant,
  onClose,
  onPreviewChange,
  sunExposureAtPlacement,
  sunSeason,
}: AddPlantModalProps) {
  const {
    arrangementDefaults,
    blockDepthFt,
    blockWidthFt,
    category,
    clusterRadiusFt,
    compareCrops,
    cropPickerLayoutStyle,
    growthForm,
    handleModeChange,
    handleQuantityChange,
    handleSelectCrop,
    handleSubmit,
    locationFilter,
    locationHelperText,
    plantCount,
    query,
    rankedCropProfiles,
    rankedCropResultsById,
    rankedCrops,
    rowLengthFt,
    selectedCrop,
    selectedMode,
    setBlockDepthFt,
    setBlockWidthFt,
    setCategory,
    setClusterRadiusFt,
    setGrowthForm,
    setLocationFilter,
    setQuery,
    setRowLengthFt,
    setSowMethod,
    setSunRequirement,
    setTimingFilter,
    setWaterNeeds,
    sowMethod,
    suitability,
    sunRequirement,
    sunWarning,
    timingFilter,
    waterNeeds,
  } = useAddPlantModalState({
    garden,
    onAddPlant,
    onPreviewChange,
    sunExposureAtPlacement,
    sunSeason,
  });

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
        <div className={styles.cropPickerLayout} style={cropPickerLayoutStyle}>
          <div className={styles.cropSearchPanel}>
            <div
              className={styles.cropFiltersPanel}
              data-testid="add-plant-filters-panel"
            >
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

            <div
              className={styles.cropResultsPanel}
              data-testid="add-plant-results-panel"
            >
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
