import { describe, expect, it } from 'vitest';

import { migrateLegacyGarden } from './legacyMigration';

describe('legacy planting geometry migration', () => {
  it('blocks a planting when the legacy garden has no honest growing area', () => {
    const result = migrateLegacyGarden(
      gardenWithPlanting({
        structures: [
          {
            depthFt: 1,
            id: 'path-1',
            label: 'Path',
            type: 'pathway',
            widthFt: 4,
            xFt: 0,
            yFt: 0,
          },
        ],
      }),
    );

    expect(result.plan.plantings[0]?.growingAreaStructureId).toBeNull();
    expect(result.blockers).toEqual([
      { code: 'missing-growing-area', plantingNumber: 1 },
    ]);
  });

  it('minimally expands only when one growing area contains every explicit instance', () => {
    const result = migrateLegacyGarden(
      gardenWithPlanting({
        instances: [
          { id: 'plant-1', label: 'Plant 1', xFt: 2, yFt: 2 },
          { id: 'plant-2', label: 'Plant 2', xFt: 2.7, yFt: 2.7 },
        ],
        structures: [
          {
            depthFt: 4,
            id: 'bed-1',
            label: 'Bed',
            type: 'raisedBed',
            widthFt: 4,
            xFt: 0,
            yFt: 0,
          },
        ],
      }),
    );

    expect(result.blockers).toEqual([]);
    expect(result.plan.plantings[0]).toMatchObject({
      growingAreaStructureId: 'bed-1',
      xFt: 2.1,
      yFt: 2.1,
    });
    expect(result.plan.plantings[0]?.depthFt).toBeCloseTo(1.2);
    expect(result.plan.plantings[0]?.widthFt).toBeCloseTo(1.2);
    expect(result.warnings).toContain(
      'Planting 1: footprint was minimally expanded to preserve explicit plant positions inside one growing area.',
    );
  });

  it('blocks out-of-footprint instances when expansion is not unambiguous', () => {
    const result = migrateLegacyGarden(
      gardenWithPlanting({
        instances: [{ id: 'plant-1', label: 'Plant 1', xFt: 2.7, yFt: 2.7 }],
      }),
    );

    expect(result.blockers).toEqual(
      expect.arrayContaining([
        { code: 'instances-outside-planting', plantingNumber: 1 },
        { code: 'missing-growing-area', plantingNumber: 1 },
      ]),
    );
  });
});

function gardenWithPlanting({
  instances,
  structures = [],
}: {
  instances?: Array<Record<string, unknown>>;
  structures?: Array<Record<string, unknown>>;
}) {
  return {
    id: 'garden',
    name: 'Garden',
    plantings: [
      {
        blockDepthFt: 1,
        blockWidthFt: 1,
        cropId: 'basil',
        id: 'basil-group',
        ...(instances ? { instances } : {}),
        label: 'Basil',
        xFt: 2,
        yFt: 2,
      },
    ],
    plot: {
      depthFt: 8,
      location: { timezone: 'America/Detroit' },
      widthFt: 12,
    },
    structures,
  };
}
