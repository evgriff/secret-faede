import type {
  CropProfile,
  PlantingMode,
} from '../../domain/gardens/GardenRepository';
import { formatFeetInput, parsePositiveNumber } from './cropPickerHelpers';
import {
  PlantingArrangementEditor,
  type PlantingArrangementChange,
} from './PlantingArrangementEditor';

export function PlantingModeControls({
  blockDepthFt,
  blockDepthPlaceholder,
  blockWidthFt,
  blockWidthPlaceholder,
  clusterRadiusFt,
  clusterRadiusPlaceholder,
  onBlockDepthChange,
  onBlockWidthChange,
  onClusterRadiusChange,
  onModeChange,
  onQuantityChange,
  onRowLengthChange,
  plantCount,
  rowLengthFt,
  rowLengthPlaceholder,
  selectedCrop,
  selectedMode,
}: {
  blockDepthFt: string;
  blockDepthPlaceholder: string;
  blockWidthFt: string;
  blockWidthPlaceholder: string;
  clusterRadiusFt: string;
  clusterRadiusPlaceholder: string;
  onBlockDepthChange(value: string): void;
  onBlockWidthChange(value: string): void;
  onClusterRadiusChange(value: string): void;
  onModeChange(mode: PlantingMode): void;
  onQuantityChange(value: string): void;
  onRowLengthChange(value: string): void;
  plantCount: number | null;
  rowLengthFt: string;
  rowLengthPlaceholder: string;
  selectedCrop: CropProfile;
  selectedMode: PlantingMode;
}) {
  function handleArrangementChange(values: PlantingArrangementChange) {
    if (values.plantCount !== undefined) {
      onQuantityChange(String(values.plantCount));
    }

    if (values.mode) {
      onModeChange(values.mode);
    }

    if (values.rowLengthFt !== undefined) {
      onRowLengthChange(formatFeetInput(values.rowLengthFt));
    }

    if (values.blockWidthFt !== undefined) {
      onBlockWidthChange(formatFeetInput(values.blockWidthFt));
    }

    if (values.blockDepthFt !== undefined) {
      onBlockDepthChange(formatFeetInput(values.blockDepthFt));
    }

    if (values.clusterRadiusFt !== undefined) {
      onClusterRadiusChange(formatFeetInput(values.clusterRadiusFt));
    }
  }

  return (
    <PlantingArrangementEditor
      crop={selectedCrop}
      mode={selectedMode}
      onChange={handleArrangementChange}
      plantCount={plantCount ?? 1}
      showQuantity
      values={{
        blockDepthFt: parsePositiveNumber(
          blockDepthFt,
          parsePositiveNumber(blockDepthPlaceholder, 1),
        ),
        blockWidthFt: parsePositiveNumber(
          blockWidthFt,
          parsePositiveNumber(blockWidthPlaceholder, 1),
        ),
        clusterRadiusFt: parsePositiveNumber(
          clusterRadiusFt,
          parsePositiveNumber(clusterRadiusPlaceholder, 1),
        ),
        rowLengthFt: parsePositiveNumber(
          rowLengthFt,
          parsePositiveNumber(rowLengthPlaceholder, 1),
        ),
      }}
    />
  );
}
