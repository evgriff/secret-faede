import type {
  PlantingGeometryDimensions,
  PlantingGeometryDot,
  PlantingGeometryInput,
  PlantingGeometryMode,
} from './plantingGeometry';

type PlantingGeometryOffset = { xFt: number; yFt: number };

// Hex rows give clusters a loose, organic feel while keeping neighbor spacing legible.
const clusterLoosenessRatio = 1.12;
const clusterHexRowHeightRatio = Math.sqrt(3) / 2;
const clusterJitterRatio = 0.12;
const clusterJitterPattern = [
  { x: 0, y: 0 },
  { x: 0.45, y: -0.15 },
  { x: -0.35, y: 0.28 },
  { x: 0.18, y: 0.38 },
  { x: -0.48, y: -0.2 },
  { x: 0.32, y: 0.18 },
] as const;

export function getGeometryOffsets({
  input,
  mode,
  quantity,
  rowSpacingFt,
  spacingFt,
}: {
  input: PlantingGeometryInput;
  mode: PlantingGeometryMode;
  quantity: number;
  rowSpacingFt: number;
  spacingFt: number;
}) {
  if (mode === 'row') {
    return getRowOffsets(quantity, spacingFt, input.rowLengthFt);
  }

  if (mode === 'block') {
    return recenterOffsets(
      getBlockOffsets({
        explicitDepthFt: input.blockDepthFt,
        explicitWidthFt: input.blockWidthFt,
        quantity,
        rowSpacingFt,
        spacingFt,
      }),
    );
  }

  return recenterOffsets(
    getClusterOffsets(quantity, spacingFt, input.clusterRadiusFt),
  );
}

export function getGeometryDimensions(
  mode: PlantingGeometryMode,
  dots: PlantingGeometryDot[],
  input: PlantingGeometryInput,
): PlantingGeometryDimensions {
  if (mode === 'row') {
    return {
      blockDepthFt: null,
      blockWidthFt: null,
      clusterRadiusFt: null,
      rowLengthFt: roundFeet(
        Math.max(
          input.rowLengthFt ?? maxDistance(dots.map((dot) => dot.xFt)),
          0,
        ),
      ),
    };
  }

  if (mode === 'block') {
    return {
      blockDepthFt: roundFeet(
        Math.max(
          input.blockDepthFt ?? maxDistance(dots.map((dot) => dot.yFt)),
          0,
        ),
      ),
      blockWidthFt: roundFeet(
        Math.max(
          input.blockWidthFt ?? maxDistance(dots.map((dot) => dot.xFt)),
          0,
        ),
      ),
      clusterRadiusFt: null,
      rowLengthFt: null,
    };
  }

  return {
    blockDepthFt: null,
    blockWidthFt: null,
    clusterRadiusFt: roundFeet(
      Math.max(
        input.clusterRadiusFt ??
          getMaxRadiusFt(
            dots.map((dot) => ({ xFt: dot.offsetXFt, yFt: dot.offsetYFt })),
          ),
        0,
      ),
    ),
    rowLengthFt: null,
  };
}

function getRowOffsets(
  quantity: number,
  spacingFt: number,
  explicitLengthFt?: number | null,
) {
  const lineLengthFt = Math.max(
    explicitLengthFt ?? spacingFt * Math.max(quantity - 1, 0),
    0,
  );
  const startX = -lineLengthFt / 2;
  const stepFt = quantity > 1 ? lineLengthFt / (quantity - 1) : 0;

  return Array.from({ length: quantity }, (_, index) => ({
    xFt: quantity === 1 ? 0 : startX + index * stepFt,
    yFt: 0,
  }));
}

function getBlockOffsets({
  explicitDepthFt,
  explicitWidthFt,
  quantity,
  rowSpacingFt,
  spacingFt,
}: {
  explicitDepthFt?: number | null | undefined;
  explicitWidthFt?: number | null | undefined;
  quantity: number;
  rowSpacingFt: number;
  spacingFt: number;
}) {
  const columns = getBlockColumns(quantity);
  const rows = getBlockRows(quantity, columns);
  const widthFt = Math.max(
    explicitWidthFt ?? spacingFt * Math.max(columns - 1, 0),
    0,
  );
  const depthFt = Math.max(
    explicitDepthFt ?? rowSpacingFt * Math.max(rows - 1, 0),
    0,
  );
  const xStep = columns > 1 ? widthFt / (columns - 1) : 0;
  const yStep = rows > 1 ? depthFt / (rows - 1) : 0;

  return Array.from({ length: quantity }, (_, index) => ({
    xFt: columns === 1 ? 0 : -widthFt / 2 + xStep * (index % columns),
    yFt: rows === 1 ? 0 : -depthFt / 2 + yStep * Math.floor(index / columns),
  }));
}

function getClusterOffsets(
  quantity: number,
  spacingFt: number,
  explicitRadiusFt?: number | null,
) {
  if (quantity === 1) {
    return [{ xFt: 0, yFt: 0 }];
  }

  const spacing = spacingFt * clusterLoosenessRatio;
  const columns = getBlockColumns(quantity);
  const rowHeightFt = spacing * clusterHexRowHeightRatio;
  const rawOffsets = Array.from({ length: quantity }, (_, index) => {
    const row = Math.floor(index / columns);
    const column = index % columns;
    const staggerFt = row % 2 === 1 ? spacing / 2 : 0;
    const jitter =
      clusterJitterPattern[index % clusterJitterPattern.length] ??
      clusterJitterPattern[0];

    return {
      xFt:
        column * spacing +
        staggerFt +
        jitter.x * spacingFt * clusterJitterRatio,
      yFt: row * rowHeightFt + jitter.y * spacingFt * clusterJitterRatio,
    };
  });
  const centeredOffsets = recenterOffsets(rawOffsets);

  if (!explicitRadiusFt) {
    return centeredOffsets;
  }

  const currentRadiusFt = getMaxRadiusFt(centeredOffsets);
  const scale = currentRadiusFt > 0 ? explicitRadiusFt / currentRadiusFt : 1;

  return centeredOffsets.map((offset) => ({
    xFt: offset.xFt * scale,
    yFt: offset.yFt * scale,
  }));
}

function getBlockColumns(quantity: number) {
  return Math.max(1, Math.ceil(Math.sqrt(quantity)));
}

function getBlockRows(quantity: number, columns: number) {
  return Math.max(1, Math.ceil(quantity / columns));
}

function recenterOffsets(
  offsets: PlantingGeometryOffset[],
): PlantingGeometryOffset[] {
  const center = {
    xFt: average(offsets.map((offset) => offset.xFt)),
    yFt: average(offsets.map((offset) => offset.yFt)),
  };

  return offsets.map((offset) => ({
    xFt: offset.xFt - center.xFt,
    yFt: offset.yFt - center.yFt,
  }));
}

function maxDistance(values: number[]) {
  return Math.max(...values) - Math.min(...values);
}

function getMaxRadiusFt(points: PlantingGeometryOffset[]) {
  return Math.max(
    ...points.map((point) => Math.sqrt(point.xFt ** 2 + point.yFt ** 2)),
  );
}

function average(values: number[]) {
  return values.reduce((total, value) => total + value, 0) / values.length;
}

export function roundFeet(value: number) {
  return Number(value.toFixed(3));
}
