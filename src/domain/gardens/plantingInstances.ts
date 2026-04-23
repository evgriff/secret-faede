import type { Planting, PlantingInstance } from './models';
import { derivePlantingGeometryFromPlanting } from './plantingGeometry';

export function getPlantingInstances(planting: Planting): PlantingInstance[] {
  if (planting.instances.length === 0) {
    return createPlantingInstances(planting);
  }

  const expectedCount = getInstanceCount(planting);
  const firstInstance = planting.instances[0];
  const hasOnlyDefaultInstance =
    planting.instances.length === 1 &&
    expectedCount > 1 &&
    firstInstance?.id === `${planting.id}-plant-1`;

  return hasOnlyDefaultInstance
    ? createPlantingInstances(planting)
    : planting.instances;
}

export function createPlantingInstances(
  planting: Omit<Planting, 'instances'> | Planting,
): PlantingInstance[] {
  const count = getInstanceCount(planting);
  const geometry = derivePlantingGeometryFromPlanting({
    ...planting,
    instances: 'instances' in planting ? planting.instances : [],
    plantCount: count,
  });
  const points = geometry.dots;

  return points.map((point, index) => ({
    id: `${planting.id}-plant-${index + 1}`,
    label: getInstanceLabel(planting, index, points.length),
    xFt: point.xFt,
    yFt: point.yFt,
  }));
}

export function withPlantingInstances(planting: Planting): Planting {
  const instances = getPlantingInstances(planting);

  return normalizePlantingFromInstances({
    ...planting,
    instances,
    plantCount: instances.length,
  });
}

export function movePlantingWithInstances(
  planting: Planting,
  point: { xFt: number; yFt: number },
): Planting {
  const instances = getPlantingInstances(planting);
  const delta = {
    xFt: point.xFt - planting.xFt,
    yFt: point.yFt - planting.yFt,
  };

  return normalizePlantingFromInstances({
    ...planting,
    instances: instances.map((instance) => ({
      ...instance,
      xFt: roundFeet(instance.xFt + delta.xFt),
      yFt: roundFeet(instance.yFt + delta.yFt),
    })),
    xFt: roundFeet(point.xFt),
    yFt: roundFeet(point.yFt),
  });
}

export function movePlantingInstance(
  planting: Planting,
  instanceId: string,
  point: { xFt: number; yFt: number },
): Planting {
  const instances = getPlantingInstances(planting);

  return normalizePlantingFromInstances({
    ...planting,
    instances: instances.map((instance) =>
      instance.id === instanceId
        ? {
            ...instance,
            xFt: roundFeet(point.xFt),
            yFt: roundFeet(point.yFt),
          }
        : instance,
    ),
  });
}

export function offsetPlantingInstances(
  planting: Planting,
  nextPlantingId: string,
  delta: { xFt: number; yFt: number },
): PlantingInstance[] {
  return getPlantingInstances(planting).map((instance, index) => ({
    ...instance,
    id: `${nextPlantingId}-plant-${index + 1}`,
    xFt: roundFeet(instance.xFt + delta.xFt),
    yFt: roundFeet(instance.yFt + delta.yFt),
  }));
}

export function normalizePlantingFromInstances(planting: Planting): Planting {
  const instances = planting.instances;

  if (instances.length === 0) {
    return planting;
  }

  return {
    ...planting,
    plantCount: instances.length,
    xFt: roundFeet(average(instances.map((instance) => instance.xFt))),
    yFt: roundFeet(average(instances.map((instance) => instance.yFt))),
  };
}

function getInstanceCount(planting: Omit<Planting, 'instances'> | Planting) {
  const savedCount = Math.max(Math.round(planting.plantCount ?? 0), 0);

  if (savedCount > 0) {
    return savedCount;
  }

  const spacingFt = derivePlantingGeometryFromPlanting({
    ...planting,
    instances: 'instances' in planting ? planting.instances : [],
    plantCount: 1,
  }).spacingFt;

  if (planting.mode === 'row' || planting.mode === 'trellisLine') {
    return Math.max(
      Math.round((planting.rowLengthFt ?? spacingFt) / spacingFt),
      1,
    );
  }

  if (planting.mode === 'block') {
    const columns = Math.max(
      Math.round((planting.blockWidthFt ?? spacingFt) / spacingFt),
      1,
    );
    const rows = Math.max(
      Math.round((planting.blockDepthFt ?? spacingFt) / spacingFt),
      1,
    );

    return columns * rows;
  }

  return 1;
}

function getInstanceLabel(
  planting: Omit<Planting, 'instances'> | Planting,
  index: number,
  count: number,
) {
  return count === 1 ? planting.label : `${planting.label} ${index + 1}`;
}

function average(values: number[]) {
  return values.reduce((total, value) => total + value, 0) / values.length;
}

function roundFeet(value: number) {
  return Number(value.toFixed(3));
}
