import type { Planting, PlantingInstance } from './models';

const minimumInstanceSpacingFt = 0.75;

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
  const spacingFt = getInstanceSpacingFt(planting);
  const points =
    planting.mode === 'row' || planting.mode === 'trellisLine'
      ? createRowPoints(planting, count, spacingFt)
      : planting.mode === 'block'
        ? createBlockPoints(planting, count, spacingFt)
        : planting.mode === 'cluster'
          ? createClusterPoints(planting, count, spacingFt)
          : [{ xFt: planting.xFt, yFt: planting.yFt }];

  return points.map((point, index) => ({
    id: `${planting.id}-plant-${index + 1}`,
    label: getInstanceLabel(planting, index, points.length),
    xFt: roundFeet(point.xFt),
    yFt: roundFeet(point.yFt),
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

function createRowPoints(
  planting: Omit<Planting, 'instances'> | Planting,
  count: number,
  spacingFt: number,
) {
  const lengthFt = Math.max(
    planting.rowLengthFt ?? spacingFt * Math.max(count - 1, 1),
    spacingFt,
  );
  const startX = planting.xFt - lengthFt / 2;
  const stepFt = count > 1 ? lengthFt / (count - 1) : 0;

  return Array.from({ length: count }, (_, index) => ({
    xFt: count === 1 ? planting.xFt : startX + stepFt * index,
    yFt: planting.yFt,
  }));
}

function createBlockPoints(
  planting: Omit<Planting, 'instances'> | Planting,
  count: number,
  spacingFt: number,
) {
  const widthFt = Math.max(planting.blockWidthFt ?? spacingFt, spacingFt);
  const depthFt = Math.max(planting.blockDepthFt ?? spacingFt, spacingFt);
  const columns = Math.max(1, Math.ceil(Math.sqrt(count)));
  const rows = Math.max(1, Math.ceil(count / columns));
  const xStep = columns > 1 ? widthFt / (columns - 1) : 0;
  const yStep = rows > 1 ? depthFt / (rows - 1) : 0;
  const left = planting.xFt - widthFt / 2;
  const top = planting.yFt - depthFt / 2;

  const points = Array.from({ length: count }, (_, index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);

    return {
      xFt: columns === 1 ? planting.xFt : left + xStep * column,
      yFt: rows === 1 ? planting.yFt : top + yStep * row,
    };
  });
  const offset = {
    xFt: planting.xFt - average(points.map((point) => point.xFt)),
    yFt: planting.yFt - average(points.map((point) => point.yFt)),
  };

  return points.map((point) => ({
    xFt: point.xFt + offset.xFt,
    yFt: point.yFt + offset.yFt,
  }));
}

function createClusterPoints(
  planting: Omit<Planting, 'instances'> | Planting,
  count: number,
  spacingFt: number,
) {
  if (count === 1) {
    return [{ xFt: planting.xFt, yFt: planting.yFt }];
  }

  const radiusFt = Math.max(
    planting.clusterRadiusFt ?? (Math.sqrt(count) * spacingFt) / 2,
    spacingFt / 2,
  );

  return Array.from({ length: count }, (_, index) => {
    const angle = (Math.PI * 2 * index) / count - Math.PI / 2;

    return {
      xFt: planting.xFt + Math.cos(angle) * radiusFt,
      yFt: planting.yFt + Math.sin(angle) * radiusFt,
    };
  });
}

function getInstanceCount(planting: Omit<Planting, 'instances'> | Planting) {
  const savedCount = Math.max(Math.round(planting.plantCount ?? 0), 0);

  if (savedCount > 0) {
    return savedCount;
  }

  const spacingFt = getInstanceSpacingFt(planting);

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

function getInstanceSpacingFt(
  planting: Omit<Planting, 'instances'> | Planting,
) {
  return Math.max(
    (planting.spacingInches ?? planting.matureSpreadInches ?? 12) / 12,
    minimumInstanceSpacingFt,
  );
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
