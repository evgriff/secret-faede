import { memo, type CSSProperties } from 'react';

import { getCropById } from '../../../domain/crops/cropCatalog';
import type { Planting } from '../../../domain/gardens/GardenRepository';
import { getPlantingInstances } from '../../../domain/gardens/plantingInstances';
import { formatFeet } from '../../garden/gardenMath';
import { getPlantingFootprint } from '../../garden/gardenPlanning';
import { getPlantGroupVisual } from '../plantVisuals';
import { PlantGroupIcon } from './PlantGroupIcon';
import { footprintStyle } from './planCanvasGeometry';
import itemStyles from './PlanCanvasItems.module.css';

export const PlanPlantingPreview = memo(function PlanPlantingPreview({
  plant,
}: {
  plant: Planting;
}) {
  const crop = plant.cropId ? getCropById(plant.cropId) : null;
  const instances = getPlantingInstances(plant);
  const footprint = getPlantingFootprint(plant);
  const visual = getPlantGroupVisual(crop, plant);
  const label = plant.label || crop?.commonName || 'Plant';
  const quantity = Math.max(instances.length, plant.plantCount ?? 1, 1);
  const style = {
    ...footprintStyle(footprint),
    '--plant-accent': visual.palette.accent,
    '--plant-accent-strong': visual.palette.strong,
    '--plant-dot': visual.palette.dot,
    '--plant-dot-alt': visual.palette.dotAlt,
    '--plant-soft': visual.palette.soft,
  } as CSSProperties;

  return (
    <div
      aria-label={`Preview ${label} group, ${quantity} ${
        quantity === 1 ? 'plant' : 'plants'
      } at X: ${formatFeet(plant.xFt)} ft, Y: ${formatFeet(plant.yFt)} ft`}
      className={`${itemStyles.plantGroup} ${itemStyles.plantingPreview} ${
        itemStyles[plant.mode] ?? ''
      }`}
      role="img"
      style={style}
    >
      <span
        className={`${itemStyles.plantGroupSurface} ${itemStyles.plantingPreviewSurface}`}
      >
        <span className={itemStyles.plantGroupDots} aria-hidden="true">
          {instances.slice(0, 28).map((instance, index) => (
            <span
              className={`${itemStyles.plantGroupDot} ${
                index % 4 === 0 ? itemStyles.plantGroupDotAlt : ''
              }`}
              key={instance.id}
              style={getDotStyle(instance, footprint)}
            />
          ))}
        </span>
        <span className={itemStyles.plantGroupIconWrap} aria-hidden="true">
          <PlantGroupIcon
            className={itemStyles.plantGroupIcon}
            icon={visual.icon}
          />
          <span className={itemStyles.plantGroupMark}>{visual.mark}</span>
        </span>
        <span className={itemStyles.plantingPreviewBadge}>
          Preview: {label}
        </span>
      </span>
    </div>
  );
});

function getDotStyle(
  instance: { xFt: number; yFt: number },
  footprint: ReturnType<typeof getPlantingFootprint>,
): CSSProperties {
  return {
    left: `${clampPercent(
      ((instance.xFt - footprint.xFt) / footprint.widthFt) * 100,
    )}%`,
    top: `${clampPercent(
      ((instance.yFt - footprint.yFt) / footprint.depthFt) * 100,
    )}%`,
  };
}

function clampPercent(value: number) {
  if (!Number.isFinite(value)) {
    return 50;
  }

  return Math.max(8, Math.min(92, value));
}
