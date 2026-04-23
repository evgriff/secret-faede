import type {
  GardenPlant,
  PlantingMode,
} from '../../domain/gardens/GardenRepository';
import type { PlantingArrangementChange } from '../garden/PlantingArrangementEditor';

export function toPlantingArrangementUpdate(
  plant: GardenPlant,
  values: PlantingArrangementChange,
): Partial<GardenPlant> {
  const nextMode = values.mode ?? plant.mode;
  const nextRowLengthFt =
    values.rowLengthFt === undefined ? plant.rowLengthFt : values.rowLengthFt;
  const update: Partial<GardenPlant> = {
    ...values,
    rowCount: isRowLikeMode(nextMode) ? 1 : null,
    trellisLengthFt: nextMode === 'trellisLine' ? nextRowLengthFt : null,
  };

  if (values.mode) {
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
