import {
  derivePlantingGeometry,
  getDerivedPlantingDimensions,
} from './plantingGeometry';

describe('plantingGeometry', () => {
  it('shrinks and expands row footprints from quantity and spacing', () => {
    const rowTwo = derivePlantingGeometry({
      mode: 'row',
      quantity: 2,
      spacingInches: 24,
      xFt: 10,
      yFt: 6,
    });
    const rowFive = derivePlantingGeometry({
      mode: 'row',
      quantity: 5,
      spacingInches: 24,
      xFt: 10,
      yFt: 6,
    });

    expect(rowTwo.dots.map(({ xFt, yFt }) => ({ xFt, yFt }))).toEqual([
      { xFt: 9, yFt: 6 },
      { xFt: 11, yFt: 6 },
    ]);
    expect(rowTwo.dimensions.rowLengthFt).toBe(2);
    expect(rowTwo.footprint).toMatchObject({
      depthFt: 2,
      widthFt: 4,
      xFt: 8,
      yFt: 5,
    });
    expect(rowFive.dimensions.rowLengthFt).toBe(8);
    expect(rowFive.footprint.widthFt).toBe(10);
    expect(rowFive.footprint.widthFt).toBeGreaterThan(rowTwo.footprint.widthFt);
  });

  it('packs block plantings into deterministic rows and columns', () => {
    const block = derivePlantingGeometry({
      mode: 'block',
      quantity: 6,
      rowSpacingInches: 24,
      spacingInches: 12,
      xFt: 10,
      yFt: 8,
    });

    expect(block.dimensions).toMatchObject({
      blockDepthFt: 2,
      blockWidthFt: 2,
      clusterRadiusFt: null,
      rowLengthFt: null,
    });
    expect(block.dots.map(({ xFt, yFt }) => ({ xFt, yFt }))).toEqual([
      { xFt: 9, yFt: 7 },
      { xFt: 10, yFt: 7 },
      { xFt: 11, yFt: 7 },
      { xFt: 9, yFt: 9 },
      { xFt: 10, yFt: 9 },
      { xFt: 11, yFt: 9 },
    ]);
    expect(block.footprint).toMatchObject({
      depthFt: 3,
      widthFt: 3,
      xFt: 8.5,
      yFt: 6.5,
    });
  });

  it('creates stable organic cluster dots without random state', () => {
    const cluster = derivePlantingGeometry({
      mode: 'cluster',
      quantity: 5,
      spacingInches: 24,
      xFt: 10,
      yFt: 8,
    });
    const repeated = derivePlantingGeometry({
      mode: 'cluster',
      quantity: 5,
      spacingInches: 24,
      xFt: 10,
      yFt: 8,
    });

    expect(repeated).toEqual(cluster);
    expect(cluster.dots.map(({ xFt, yFt }) => ({ xFt, yFt }))).toEqual([
      { xFt: 7.77, yFt: 7.209 },
      { xFt: 10.118, yFt: 7.173 },
      { xFt: 12.166, yFt: 7.276 },
      { xFt: 8.933, yFt: 9.24 },
      { xFt: 11.014, yFt: 9.101 },
    ]);
    expect(cluster.dimensions.clusterRadiusFt).toBe(2.366);
    expect(JSON.parse(JSON.stringify(cluster))).toEqual(cluster);
  });

  it('produces different serializable geometry when placement mode changes', () => {
    const base = {
      quantity: 6,
      rowSpacingInches: 24,
      spacingInches: 24,
      xFt: 8,
      yFt: 5,
    };
    const row = derivePlantingGeometry({ ...base, mode: 'row' });
    const block = derivePlantingGeometry({ ...base, mode: 'block' });
    const cluster = derivePlantingGeometry({ ...base, mode: 'cluster' });

    expect(row.footprint).not.toEqual(block.footprint);
    expect(block.footprint).not.toEqual(cluster.footprint);
    expect(row.dimensions).toMatchObject({
      blockDepthFt: null,
      blockWidthFt: null,
      clusterRadiusFt: null,
      rowLengthFt: 10,
    });
    expect(block.dimensions).toMatchObject({
      blockDepthFt: 2,
      blockWidthFt: 4,
      clusterRadiusFt: null,
      rowLengthFt: null,
    });
    expect(getDerivedPlantingDimensions({ ...base, mode: 'cluster' })).toEqual(
      cluster.dimensions,
    );
  });
});
