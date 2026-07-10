import type { GardenPlan } from '../domain';

export function applySharedPlanSettings(
  base: GardenPlan,
  supplied: GardenPlan,
  updatedAtIso: string,
): GardenPlan {
  return {
    ...base,
    plot: {
      ...base.plot,
      climate: { ...supplied.plot.climate },
      location: {
        ...supplied.plot.location,
        coordinates: supplied.plot.location.coordinates
          ? { ...supplied.plot.location.coordinates }
          : null,
      },
    },
    updatedAtIso,
  };
}
