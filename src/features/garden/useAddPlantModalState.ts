import {
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type FormEvent,
} from 'react';

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
import { getCalendarDateInTimeZone } from '../../shared/lib/timezoneDate';
import type {
  CategoryFilter,
  GrowthFormFilter,
  LocationFilter,
  SowMethodFilter,
  SunRequirementFilter,
  TimingFilter,
  WaterNeedsFilter,
} from './CropPickerFilters';
import { buildAddPlantRequest } from './addPlantRequest';
import {
  calculatePlantCount,
  calculateRequestedAreaSqFt,
  compareCropPickerResults,
  coercePlantQuantity,
  formatLabel,
  formatLocationSource,
  getPlantingArrangementDefaults,
  getRecommendedPlantingMode,
  isLocationFit,
  parsePositiveNumber,
  type RankedCropPickerResult,
} from './cropPickerHelpers';
import { cropSunRequirementMet, type SunSeason } from './sunShadeEngine';
import type { AddPlantingRequest } from './useGarden';

export const CROP_RESULT_ROW_HEIGHT_PX = 96;

export function useAddPlantModalState({
  garden,
  onAddPlant,
  onPreviewChange,
  sunExposureAtPlacement,
  sunSeason,
}: {
  garden: Garden;
  onAddPlant(request: AddPlantingRequest): void;
  onPreviewChange: ((request: AddPlantingRequest | null) => void) | undefined;
  sunExposureAtPlacement: SunExposure | null;
  sunSeason: SunSeason;
}) {
  const [analysisDate] = useState(() =>
    getCalendarDateInTimeZone(new Date(), garden.plot.location.timezone),
  );
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
  const cropPickerLayoutStyle = useMemo(
    () =>
      ({
        '--crop-result-row-height-px': `${CROP_RESULT_ROW_HEIGHT_PX}px`,
      }) as CSSProperties,
    [],
  );

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
              today: analysisDate,
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
      analysisDate,
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
    today: analysisDate,
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

  function clearCustomArrangement() {
    setRowLengthFt('');
    setBlockWidthFt('');
    setBlockDepthFt('');
    setClusterRadiusFt('');
  }

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

  return {
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
  };
}

function getDefaultCrop() {
  const crop = cropCatalog[0];

  if (!crop) {
    throw new Error('Crop catalog is empty.');
  }

  return crop;
}
