import type { PlantingMode } from '../../domain/gardens/GardenRepository';
import type { AddPlantingRequest } from './useGarden';

export function buildAddPlantRequest({
  crop,
  effectiveBlockDepthFt,
  effectiveBlockWidthFt,
  effectiveClusterRadiusFt,
  effectiveRowLengthFt,
  plantCount,
  selectedMode,
}: {
  crop: AddPlantingRequest['crop'];
  effectiveBlockDepthFt: number;
  effectiveBlockWidthFt: number;
  effectiveClusterRadiusFt: number;
  effectiveRowLengthFt: number;
  plantCount: number;
  selectedMode: PlantingMode;
}): AddPlantingRequest {
  return {
    blockDepthFt: selectedMode === 'block' ? effectiveBlockDepthFt : null,
    blockWidthFt: selectedMode === 'block' ? effectiveBlockWidthFt : null,
    clusterRadiusFt:
      selectedMode === 'cluster' ? effectiveClusterRadiusFt : null,
    crop,
    mode: selectedMode,
    plantCount,
    rowLengthFt:
      selectedMode === 'row' || selectedMode === 'trellisLine'
        ? effectiveRowLengthFt
        : null,
  };
}
