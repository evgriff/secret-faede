import type { GardenPlan, GardenStructure, PlantingGroup } from '../../domain';
import { movePlantingGroup } from './planModel';

export function createTemplateStructures(input: {
  depthFt: number;
  template: 'blank' | 'containers' | 'raisedBed';
  widthFt: number;
}): GardenStructure[] {
  if (input.template === 'blank') return [];
  if (input.template === 'raisedBed') {
    const widthFt = Math.min(4, input.widthFt);
    const depthFt = Math.min(8, input.depthFt);
    return [
      createStructure({
        depthFt,
        label: 'Raised bed',
        type: 'raisedBed',
        widthFt,
        xFt: Math.max((input.widthFt - widthFt) / 2, 0),
        yFt: Math.max((input.depthFt - depthFt) / 2, 0),
      }),
    ];
  }
  const diameter = Math.max(
    Math.min(input.widthFt / 4, input.depthFt / 2, 2),
    0.5,
  );
  return Array.from({ length: 3 }, (_, index) =>
    createStructure({
      depthFt: diameter,
      label: `Container ${index + 1}`,
      type: 'container',
      widthFt: diameter,
      xFt: Math.min(
        (input.widthFt * (index + 1)) / 4 - diameter / 2,
        input.widthFt - diameter,
      ),
      yFt: Math.max(input.depthFt / 2 - diameter / 2, 0),
    }),
  );
}

function createStructure(input: {
  depthFt: number;
  label: string;
  type: GardenStructure['type'];
  widthFt: number;
  xFt: number;
  yFt: number;
}): GardenStructure {
  return {
    ...input,
    drainage: 'unknown',
    id: `structure-${crypto.randomUUID()}`,
    irrigationZoneId: null,
    locked: false,
    mulched: false,
    notes: '',
    rotationDegrees: 0,
    soilDepthInches: null,
    soilType: 'unknown',
  };
}

export function duplicatePlanting(
  group: PlantingGroup,
  plan: GardenPlan,
): PlantingGroup {
  const id = `crop-${group.cropId}-${crypto.randomUUID()}`;
  const offset = plan.plot.snapFt * 4;
  const xFt = Math.min(
    group.xFt + offset,
    plan.plot.widthFt - group.widthFt / 2,
  );
  const yFt = Math.min(
    group.yFt + offset,
    plan.plot.depthFt - group.depthFt / 2,
  );
  const deltaX = xFt - group.xFt;
  const deltaY = yFt - group.yFt;
  return {
    ...structuredClone(group),
    id,
    instances: group.instances.map((instance, index) => ({
      ...instance,
      id: `${id}-plant-${index + 1}`,
      xFt: instance.xFt + deltaX,
      yFt: instance.yFt + deltaY,
    })),
    locked: false,
    xFt,
    yFt,
  };
}

export function applyPlantingInspectorUpdate(
  plan: GardenPlan,
  next: PlantingGroup,
) {
  const previous = plan.plantings.find((item) => item.id === next.id);
  if (!previous) return plan;
  const moved = movePlantingGroup(plan, next.id, {
    xFt: next.xFt,
    yFt: next.yFt,
  });
  const movedGroup = moved.plantings.find((item) => item.id === next.id);
  const centerChanged = previous.xFt !== next.xFt || previous.yFt !== next.yFt;
  return {
    ...moved,
    plantings: moved.plantings.map((item) =>
      item.id === next.id
        ? {
            ...next,
            instances: centerChanged
              ? (movedGroup?.instances ?? next.instances)
              : next.instances,
            xFt: movedGroup?.xFt ?? next.xFt,
            yFt: movedGroup?.yFt ?? next.yFt,
          }
        : item,
    ),
  };
}
