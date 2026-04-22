import { memo, type PointerEvent } from 'react';

import type { Planting } from '../../../domain/gardens/GardenRepository';
import { isPlantingAnchoredByLifecycle } from '../../garden/gardenImmutability';
import { formatFeet } from '../../garden/gardenMath';
import { getPlantingFootprint } from '../../garden/gardenPlanning';
import { PlantIcon } from '../../garden/PlantIcon';
import type { SelectedGardenItem } from '../../garden/useGarden';
import { footprintStyle } from './planCanvasGeometry';
import itemStyles from './PlanCanvasItems.module.css';

export const PlanPlantButton = memo(function PlanPlantButton({
  hasWarning,
  index,
  isDragging,
  isSelected,
  onPlantPointerDown,
  onPlantPointerEnd,
  onPlantPointerMove,
  onSelectItem,
  plant,
}: {
  hasWarning: boolean;
  index: number;
  isDragging: boolean;
  isSelected: boolean;
  onPlantPointerDown(
    event: PointerEvent<HTMLButtonElement>,
    plantId: string,
  ): void;
  onPlantPointerEnd(
    event: PointerEvent<HTMLButtonElement>,
    plantId: string,
  ): void;
  onPlantPointerMove(
    event: PointerEvent<HTMLButtonElement>,
    plantId: string,
  ): void;
  onSelectItem(item: SelectedGardenItem, additive: boolean): void;
  plant: Planting;
}) {
  const footprint = getPlantingFootprint(plant);
  const isAnchored = isPlantingAnchoredByLifecycle(plant);

  return (
    <button
      aria-label={`${plant.label || `Plant ${index + 1}`} at X: ${formatFeet(
        plant.xFt,
      )} ft, Y: ${formatFeet(plant.yFt)} ft`}
      aria-pressed={isSelected}
      className={`${itemStyles.plant} ${itemStyles[plant.mode] ?? ''} ${
        itemStyles[plant.status] ?? ''
      } ${isSelected ? itemStyles.selectedPlant : ''} ${
        isDragging ? itemStyles.draggingPlant : ''
      } ${plant.locked ? itemStyles.lockedItem : ''} ${
        isAnchored ? itemStyles.anchoredItem : ''
      } ${hasWarning ? itemStyles.warningItem : ''}`}
      data-plan-item="true"
      onClick={(event) => {
        if (event.detail === 0) {
          onSelectItem({ id: plant.id, type: 'planting' }, event.shiftKey);
        }
      }}
      onPointerCancel={(event) => onPlantPointerEnd(event, plant.id)}
      onPointerDown={(event) => onPlantPointerDown(event, plant.id)}
      onPointerMove={(event) => onPlantPointerMove(event, plant.id)}
      onPointerUp={(event) => onPlantPointerEnd(event, plant.id)}
      style={footprintStyle(footprint)}
      type="button"
    >
      <PlantIcon title="" />
      <span>{plant.label}</span>
      <small>{formatPlantStatus(plant.status)}</small>
    </button>
  );
});

function formatPlantStatus(status: string) {
  if (status === 'harvest-ready') {
    return 'ready';
  }

  return status;
}
