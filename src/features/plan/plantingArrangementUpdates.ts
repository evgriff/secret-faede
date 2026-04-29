import {
  getDerivedPlantingDimensions,
  type GardenPlant,
  type PlantingMode,
} from '../../domain/gardens/GardenRepository';
import type { PlantingArrangementChange } from '../garden/PlantingArrangementEditor';

export function toPlantingArrangementUpdate(
  plant: GardenPlant,
  values: PlantingArrangementChange,
): Partial<GardenPlant> {
  const nextMode = values.mode ?? plant.mode;
  const nextQuantity =
    values.plantCount ?? plant.plantCount ?? plant.instances.length ?? 1;
  const nextSpacingInches =
    values.spacingInches === undefined
      ? plant.spacingInches
      : values.spacingInches;
  const shouldDeriveDimensions = Boolean(
    values.mode !== undefined ||
    values.plantCount !== undefined ||
    values.spacingInches !== undefined,
  );
  const derivedDimensions: Partial<
    Pick<
      GardenPlant,
      'blockDepthFt' | 'blockWidthFt' | 'clusterRadiusFt' | 'rowLengthFt'
    >
  > = shouldDeriveDimensions
    ? getDerivedPlantingDimensions({
        ...plant,
        mode: nextMode,
        quantity: nextQuantity,
        spacingInches: nextSpacingInches,
      })
    : {};
  const nextRowLengthFt =
    derivedDimensions.rowLengthFt ??
    (values.rowLengthFt === undefined ? plant.rowLengthFt : values.rowLengthFt);
  const update: Partial<GardenPlant> = {
    ...values,
    ...derivedDimensions,
    rowCount: isRowLikeMode(nextMode) ? 1 : null,
    trellisLengthFt: nextMode === 'trellisLine' ? nextRowLengthFt : null,
  };

  if (values.mode && !shouldDeriveDimensions) {
    update.blockDepthFt =
      nextMode === 'block' ? (values.blockDepthFt ?? plant.blockDepthFt) : null;
    update.blockWidthFt =
      nextMode === 'block' ? (values.blockWidthFt ?? plant.blockWidthFt) : null;
    update.clusterRadiusFt =
      nextMode === 'cluster'
        ? (values.clusterRadiusFt ?? plant.clusterRadiusFt)
        : null;
    update.rowLengthFt =
      nextMode === 'row' || nextMode === 'trellisLine' ? nextRowLengthFt : null;
  }

  return update;
}

function isRowLikeMode(mode: PlantingMode) {
  return mode === 'row' || mode === 'block' || mode === 'trellisLine';
}
