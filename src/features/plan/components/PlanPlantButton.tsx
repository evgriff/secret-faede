import { memo, type PointerEvent } from 'react';

import { getCropById } from '../../../domain/crops/cropCatalog';
import type {
  Planting,
  PlantingInstance,
} from '../../../domain/gardens/GardenRepository';
import { isPlantingAnchoredByLifecycle } from '../../garden/gardenImmutability';
import { formatFeet } from '../../garden/gardenMath';
import type { PlanWarning } from '../../garden/gardenPlanning';
import { getCropSupportNeed } from '../../garden/gardenStructureRules';
import { PlantIcon } from '../../garden/PlantIcon';
import type { SelectedGardenItem } from '../../garden/useGarden';
import { footprintStyle } from './planCanvasGeometry';
import itemStyles from './PlanCanvasItems.module.css';

export const PlanPlantButton = memo(function PlanPlantButton({
  index,
  instance,
  isCropFocused,
  isDragging,
  isFocusDimmed,
  isSelected,
  onPlantPointerDown,
  onPlantPointerEnd,
  onPlantPointerMove,
  onPlantHoverChange,
  onSelectItem,
  plant,
  warnings,
}: {
  index: number;
  instance: PlantingInstance;
  isCropFocused: boolean;
  isDragging: boolean;
  isFocusDimmed: boolean;
  isSelected: boolean;
  onPlantPointerDown(
    event: PointerEvent<HTMLButtonElement>,
    plantId: string,
    instanceId?: string,
  ): void;
  onPlantPointerEnd(
    event: PointerEvent<HTMLButtonElement>,
    plantId: string,
    instanceId?: string,
  ): void;
  onPlantPointerMove(
    event: PointerEvent<HTMLButtonElement>,
    plantId: string,
    instanceId?: string,
  ): void;
  onPlantHoverChange(plantId: string | null): void;
  onSelectItem(
    item: SelectedGardenItem,
    additive: boolean,
    options?: { openSurface?: boolean },
  ): void;
  plant: Planting;
  warnings: PlanWarning[];
}) {
  const isAnchored = isPlantingAnchoredByLifecycle(plant);
  const crop = plant.cropId ? getCropById(plant.cropId) : null;
  const label = instance.label || plant.label || `Plant ${index + 1}`;
  const footprint = getPlantNodeFootprint(instance, label);
  const showContextSignals = isSelected || isCropFocused;
  const hasSupportNeed =
    (showContextSignals && Boolean(crop && getCropSupportNeed(crop))) ||
    warnings.some((warning) => warning.kind === 'trellis');
  const hasWarning = warnings.some((warning) => warning.kind !== 'trellis');

  return (
    <button
      aria-label={`${label} at X: ${formatFeet(instance.xFt)} ft, Y: ${formatFeet(
        instance.yFt,
      )} ft`}
      aria-pressed={isSelected}
      className={`${itemStyles.plant} ${itemStyles[plant.mode] ?? ''} ${
        itemStyles[plant.status] ?? ''
      } ${isSelected ? itemStyles.selectedPlant : ''} ${
        isDragging ? itemStyles.draggingPlant : ''
      } ${plant.locked ? itemStyles.lockedItem : ''} ${
        isAnchored ? itemStyles.anchoredItem : ''
      } ${isCropFocused ? itemStyles.cropFocusedPlant : ''} ${
        isFocusDimmed ? itemStyles.cropFocusDimmed : ''
      } ${hasWarning ? itemStyles.warningItem : ''}`}
      data-plan-item="true"
      onClick={(event) => {
        if (event.detail === 0) {
          onSelectItem(
            { id: plant.id, instanceId: instance.id, type: 'planting' },
            event.shiftKey,
            { openSurface: false },
          );
        }
      }}
      onPointerCancel={(event) =>
        onPlantPointerEnd(event, plant.id, instance.id)
      }
      onPointerDown={(event) =>
        onPlantPointerDown(event, plant.id, instance.id)
      }
      onPointerEnter={() => onPlantHoverChange(plant.id)}
      onPointerLeave={() => onPlantHoverChange(null)}
      onPointerMove={(event) =>
        onPlantPointerMove(event, plant.id, instance.id)
      }
      onPointerUp={(event) => onPlantPointerEnd(event, plant.id, instance.id)}
      style={footprintStyle(footprint)}
      type="button"
    >
      <span aria-hidden="true" className={itemStyles.plantStatusStrip} />
      <span className={itemStyles.plantBody}>
        <PlantIcon className={itemStyles.plantIcon} title="" />
        <span className={itemStyles.plantLabel}>{label}</span>
        <span className={itemStyles.plantStatusText}>
          {formatPlantStatus(plant.status)}
        </span>
      </span>
      {plant.locked || isAnchored || hasSupportNeed || hasWarning ? (
        <span className={itemStyles.plantSignals}>
          {isAnchored ? (
            <span
              className={`${itemStyles.plantSignal} ${itemStyles.anchorSignal}`}
            >
              Anchored
            </span>
          ) : null}
          {plant.locked ? (
            <span
              className={`${itemStyles.plantSignal} ${itemStyles.lockSignal}`}
            >
              Locked
            </span>
          ) : null}
          {hasSupportNeed ? (
            <span
              className={`${itemStyles.plantSignal} ${itemStyles.supportSignal}`}
            >
              Support
            </span>
          ) : null}
          {hasWarning ? (
            <span
              className={`${itemStyles.plantSignal} ${itemStyles.warningSignal}`}
            >
              Check
            </span>
          ) : null}
        </span>
      ) : null}
    </button>
  );
});

function formatPlantStatus(status: Planting['status']) {
  const labels: Record<Planting['status'], string> = {
    growing: 'Growing',
    'harvest-ready': 'Harvest',
    harvested: 'Harvested',
    planned: 'Planned',
    planted: 'Planted',
    removed: 'Removed',
  };

  return labels[status];
}

function getPlantNodeFootprint(instance: PlantingInstance, label: string) {
  const widthFt = 1.55;
  const depthFt = 1.15;

  return {
    depthFt,
    id: instance.id,
    itemType: 'planting' as const,
    label,
    widthFt,
    xFt: instance.xFt - widthFt / 2,
    yFt: instance.yFt - depthFt / 2,
  };
}
