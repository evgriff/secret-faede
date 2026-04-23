import { useEffect, useMemo, useState } from 'react';

import { filterCropCatalog } from '../../../domain/crops/cropCatalog';
import {
  createPlantLocationContext,
  scorePlantLocationMatch,
} from '../../../domain/crops/plantLocationMatch';
import type {
  CropProfile,
  Garden,
  PlantingMode,
  SunExposure,
} from '../../../domain/gardens/GardenRepository';
import { coercePlantQuantity } from '../../garden/cropPickerHelpers';
import { VirtualCropResultList } from '../../garden/VirtualCropResultList';
import {
  ChoosePlantsFilters,
  type CategoryFilter,
  type LifecycleFilter,
  type LocationMatchFilter,
  type SunRequirementFilter,
  type WaterNeedsFilter,
} from './ChoosePlantsFilters';
import { CropLibraryResult } from './ChoosePlantsLibraryResult';
import styles from './ChoosePlantsModal.module.css';
import {
  getQuantityFirstPlantingModes,
  normalizeSeasonPlantingForm,
} from './choosePlantsSelection';
import { useChooserCardHeight } from './useChooserCardHeight';

interface ChoosePlantsLibraryProps {
  compareCropIds: string[];
  garden: Garden;
  onAddCrop: (
    crop: CropProfile,
    quantity?: number,
    plantingForm?: PlantingMode,
  ) => void;
  onCompareQuantityChange: (crop: CropProfile, quantity: number) => void;
  onToggleCompare: (crop: CropProfile, quantity?: number) => void;
  selectedCropIds: Set<string>;
  sunExposureAtPlacement: SunExposure | null;
}

export function ChoosePlantsLibrary({
  compareCropIds,
  garden,
  onAddCrop,
  onCompareQuantityChange,
  onToggleCompare,
  selectedCropIds,
  sunExposureAtPlacement,
}: ChoosePlantsLibraryProps) {
  const [category, setCategory] = useState<CategoryFilter>('any');
  const [lifecycle, setLifecycle] = useState<LifecycleFilter>('any');
  const [locationMatch, setLocationMatch] =
    useState<LocationMatchFilter>('any');
  const [query, setQuery] = useState('');
  const [sunRequirement, setSunRequirement] =
    useState<SunRequirementFilter>('any');
  const [waterNeeds, setWaterNeeds] = useState<WaterNeedsFilter>('any');
  const [quantityValuesByCropId, setQuantityValuesByCropId] = useState<
    Record<string, string>
  >({});
  const [plantingModesByCropId, setPlantingModesByCropId] = useState<
    Record<string, PlantingMode>
  >({});
  const [expandedCropId, setExpandedCropId] = useState<string | null>(null);
  const itemHeightPx = useChooserCardHeight(expandedCropId !== null);
  const locationContext = useMemo(
    () =>
      createPlantLocationContext({
        climateProfile: garden.climateProfile,
        location: garden.plot.location,
      }),
    [garden.climateProfile, garden.plot.location],
  );
  const catalogCrops = useMemo(
    () =>
      filterCropCatalog({
        category,
        lifecycle,
        query,
        sunRequirement,
        waterNeeds,
      }),
    [category, lifecycle, query, sunRequirement, waterNeeds],
  );
  const filteredCrops = useMemo(
    () =>
      locationMatch === 'any'
        ? catalogCrops
        : catalogCrops.filter(
            (crop) =>
              scorePlantLocationMatch({
                context: locationContext,
                crop,
                sunExposureAtPlacement,
              }).band === locationMatch,
          ),
    [catalogCrops, locationContext, locationMatch, sunExposureAtPlacement],
  );

  useEffect(() => {
    if (
      expandedCropId &&
      !filteredCrops.some((crop) => crop.id === expandedCropId)
    ) {
      setExpandedCropId(null);
    }
  }, [expandedCropId, filteredCrops]);

  function getQuantity(crop: CropProfile) {
    return coercePlantQuantity(getQuantityValue(crop));
  }

  function getMode(crop: CropProfile) {
    return normalizeSeasonPlantingForm(
      crop,
      getQuantity(crop),
      plantingModesByCropId[crop.id],
    );
  }

  function getQuantityValue(crop: CropProfile) {
    return quantityValuesByCropId[crop.id] ?? '1';
  }

  function updateQuantity(crop: CropProfile, value: string) {
    const currentQuantity = getQuantity(crop);
    const currentRecommendedMode = normalizeSeasonPlantingForm(
      crop,
      currentQuantity,
    );
    const currentMode = getMode(crop);
    const quantity = coercePlantQuantity(value);
    const nextRecommendedMode = normalizeSeasonPlantingForm(crop, quantity);
    const nextModeOptions = getQuantityFirstPlantingModes(crop, quantity);

    setQuantityValuesByCropId((currentQuantities) => ({
      ...currentQuantities,
      [crop.id]: value,
    }));
    setPlantingModesByCropId((currentModes) => {
      if (
        currentMode !== currentRecommendedMode &&
        nextModeOptions.includes(currentMode)
      ) {
        return currentModes;
      }

      return {
        ...currentModes,
        [crop.id]: nextRecommendedMode,
      };
    });

    if (compareCropIds.includes(crop.id)) {
      onCompareQuantityChange(crop, quantity);
    }
  }

  function normalizeQuantity(crop: CropProfile) {
    const quantity = getQuantity(crop);

    setQuantityValuesByCropId((currentQuantities) => ({
      ...currentQuantities,
      [crop.id]: String(quantity),
    }));
    setPlantingModesByCropId((currentModes) => ({
      ...currentModes,
      [crop.id]: normalizeSeasonPlantingForm(
        crop,
        quantity,
        currentModes[crop.id],
      ),
    }));
  }

  function updateMode(crop: CropProfile, mode: PlantingMode) {
    setPlantingModesByCropId((currentModes) => ({
      ...currentModes,
      [crop.id]: normalizeSeasonPlantingForm(crop, getQuantity(crop), mode),
    }));
  }

  return (
    <section className={styles.library} aria-label="Plant library">
      <ChoosePlantsFilters
        category={category}
        lifecycle={lifecycle}
        locationMatch={locationMatch}
        onCategoryChange={setCategory}
        onLifecycleChange={setLifecycle}
        onLocationMatchChange={setLocationMatch}
        onQueryChange={setQuery}
        onSunRequirementChange={setSunRequirement}
        onWaterNeedsChange={setWaterNeeds}
        query={query}
        sunRequirement={sunRequirement}
        waterNeeds={waterNeeds}
      />

      <VirtualCropResultList
        className={styles.results}
        crops={filteredCrops}
        empty={<p className={styles.emptyText}>No matching plants.</p>}
        itemHeightPx={itemHeightPx}
        renderCrop={(crop) => (
          <CropLibraryResult
            compareDisabled={
              compareCropIds.length >= 3 && !compareCropIds.includes(crop.id)
            }
            crop={crop}
            garden={garden}
            isExpanded={expandedCropId === crop.id}
            isComparing={compareCropIds.includes(crop.id)}
            isSelected={selectedCropIds.has(crop.id)}
            mode={getMode(crop)}
            modeOptions={getQuantityFirstPlantingModes(crop, getQuantity(crop))}
            onAdd={() => onAddCrop(crop, getQuantity(crop), getMode(crop))}
            onModeChange={(mode) => updateMode(crop, mode)}
            onQuantityBlur={() => normalizeQuantity(crop)}
            onQuantityChange={(value) => updateQuantity(crop, value)}
            onToggleExpanded={() =>
              setExpandedCropId((currentCropId) =>
                currentCropId === crop.id ? null : crop.id,
              )
            }
            onToggleCompare={() => onToggleCompare(crop, getQuantity(crop))}
            quantity={getQuantity(crop)}
            quantityValue={getQuantityValue(crop)}
            sunExposureAtPlacement={sunExposureAtPlacement}
          />
        )}
      />
    </section>
  );
}
