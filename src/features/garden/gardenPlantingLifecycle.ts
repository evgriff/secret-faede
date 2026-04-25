import {
  appendPlantingEvent,
  normalizePlantSupportPlanForQuantity,
  type Garden,
} from '../../domain/gardens/GardenRepository';
import { normalizePlantingFromInstances } from '../../domain/gardens/plantingInstances';
import { applyPlantingEventEffects } from './plantingEventEffects';

export function markPlantingsPlantedInGarden({
  garden,
  now,
  plantedOn,
  plantingIds,
}: {
  garden: Garden;
  now: Date;
  plantedOn: string;
  plantingIds: string[];
}) {
  const plantingIdSet = new Set(plantingIds);
  const nextPlantings = garden.plantings.map((planting) => {
    if (!plantingIdSet.has(planting.id)) {
      return planting;
    }

    const normalizedPlanting = normalizePlantingFromInstances(
      appendPlantingEvent(planting, {
        occurredOn: plantedOn,
        type: 'plantedOut',
      }),
    );

    return {
      ...normalizedPlanting,
      support: normalizePlantSupportPlanForQuantity(
        normalizedPlanting.support,
        normalizedPlanting.plantCount ?? normalizedPlanting.instances.length,
      ),
    };
  });

  return applyPlantingEventEffects({
    garden,
    nextPlantings,
    now,
  });
}
