import {
  createDefaultGarden,
  createDefaultPlanting,
  createDefaultStructure,
  type Garden,
  type Structure,
} from '../../domain/gardens/GardenRepository';
import { withPlantingInstances } from '../../domain/gardens/plantingInstances';
import {
  calculateResizeRect,
  defaultPlanSnapFt,
  getItemsInRect,
  getItemRect,
  snapItemPoint,
  snapResizeRect,
} from './planInteractionGeometry';

describe('planInteractionGeometry', () => {
  it('uses eighth-foot fine snapping by default', () => {
    expect(defaultPlanSnapFt).toBe(0.125);

    const garden = createInteractionGarden();
    const item = { id: 'moving-bed', type: 'structure' as const };
    const sourceRect = getItemRect(garden, item);

    if (!sourceRect) {
      throw new Error('Expected moving bed rect.');
    }

    const result = snapItemPoint({
      garden,
      item,
      point: { xFt: 0.42, yFt: 0.58 },
      sourceRect,
    });

    expect(result.point).toEqual({ xFt: 0.375, yFt: 0.625 });
  });

  it('clamps free dragging by the full item footprint', () => {
    const garden = createInteractionGarden();
    const item = { id: 'moving-bed', type: 'structure' as const };
    const sourceRect = getItemRect(garden, item);

    if (!sourceRect) {
      throw new Error('Expected moving bed rect.');
    }

    const result = snapItemPoint({
      freeMove: true,
      garden,
      item,
      point: { xFt: 11.9, yFt: 7.9 },
      sourceRect,
    });

    expect(result.point).toEqual({ xFt: 10, yFt: 6 });
    expect(result.guides).toHaveLength(0);
  });

  it('snaps structures all the way into plot corners', () => {
    const garden = createInteractionGarden();
    const item = { id: 'moving-bed', type: 'structure' as const };
    const sourceRect = getItemRect(garden, item);

    if (!sourceRect) {
      throw new Error('Expected moving bed rect.');
    }

    const result = snapItemPoint({
      garden,
      item,
      point: { xFt: 0.11, yFt: 0.09 },
      sourceRect,
      snapExclusions: [item],
    });

    expect(result.point).toEqual({ xFt: 0, yFt: 0 });
    expect(result.guides).toEqual(
      expect.arrayContaining([
        { axis: 'x', valueFt: 0 },
        { axis: 'y', valueFt: 0 },
      ]),
    );
  });

  it('snaps structure corners and edges to neighboring bed boundaries', () => {
    const garden = createInteractionGarden();
    const item = { id: 'moving-bed', type: 'structure' as const };
    const sourceRect = getItemRect(garden, item);

    if (!sourceRect) {
      throw new Error('Expected moving bed rect.');
    }

    const result = snapItemPoint({
      garden,
      item,
      point: { xFt: 5.88, yFt: 2.08 },
      sourceRect,
      snapExclusions: [item],
    });

    expect(result.point).toEqual({ xFt: 6, yFt: 2 });
    expect(result.guides).toEqual(
      expect.arrayContaining([
        { axis: 'x', valueFt: 6 },
        { axis: 'y', valueFt: 2 },
      ]),
    );
  });

  it('snaps plant centers to plot and trellis centerlines', () => {
    const garden = createInteractionGarden();
    const item = { id: 'tomato', type: 'planting' as const };
    const sourceRect = getItemRect(garden, item);

    if (!sourceRect) {
      throw new Error('Expected tomato rect.');
    }

    const result = snapItemPoint({
      garden,
      item,
      point: { xFt: 8.92, yFt: 6.12 },
      sourceRect,
      snapExclusions: [item],
    });

    expect(result.point).toEqual({ xFt: 9, yFt: 6 });
    expect(result.guides).toEqual(
      expect.arrayContaining([
        { axis: 'x', valueFt: 9 },
        { axis: 'y', valueFt: 6 },
      ]),
    );
  });

  it('selects an arrangement footprint as one plant group', () => {
    const garden = {
      ...createInteractionGarden(),
      plantings: [
        ...createInteractionGarden().plantings,
        withPlantingInstances({
          ...createDefaultPlanting({
            id: 'carrot-row',
            label: 'Carrot',
            xFt: 4,
            yFt: 5,
          }),
          mode: 'row',
          plantCount: 3,
          rowLengthFt: 4,
          spacingInches: 24,
        }),
      ],
    };
    const item = {
      id: 'carrot-row',
      instanceId: 'carrot-row-plant-2',
      type: 'planting' as const,
    };
    const rect = getItemRect(garden, item);

    expect(rect).toMatchObject({
      id: 'carrot-row-plant-2',
      xFt: 3,
      yFt: 4,
    });
    expect(
      getItemsInRect(garden, {
        depthFt: 0.5,
        id: 'selection',
        itemType: 'structure',
        label: 'Selection',
        widthFt: 3.8,
        xFt: 2.1,
        yFt: 4.8,
      }),
    ).toEqual([{ id: 'carrot-row', type: 'planting' }]);
  });

  it('allows temporary free move without snapping', () => {
    const garden = createInteractionGarden();
    const item = { id: 'moving-bed', type: 'structure' as const };
    const sourceRect = getItemRect(garden, item);

    if (!sourceRect) {
      throw new Error('Expected moving bed rect.');
    }

    const result = snapItemPoint({
      freeMove: true,
      garden,
      item,
      point: { xFt: 1.37, yFt: 1.62 },
      sourceRect,
    });

    expect(result.point).toEqual({ xFt: 1.37, yFt: 1.62 });
    expect(result.guides).toHaveLength(0);
  });

  it('snaps resize handles to neighboring structure edges', () => {
    const garden = createInteractionGarden();
    const item = { id: 'moving-bed', type: 'structure' as const };
    const sourceRect = getItemRect(garden, item);

    if (!sourceRect) {
      throw new Error('Expected moving bed rect.');
    }

    const resizedRect = calculateResizeRect({
      currentPoint: { xFt: 5.9, yFt: 3 },
      garden,
      handle: 'east',
      originalRect: sourceRect,
    });
    const result = snapResizeRect({
      garden,
      handle: 'east',
      rect: resizedRect,
      snapExclusions: [item],
    });

    expect(result.rect.widthFt).toBe(4);
    expect(result.rect.xFt).toBe(2);
    expect(result.guides).toContainEqual({ axis: 'x', valueFt: 6 });
  });

  it('snaps north-west resize handles to the plot corner', () => {
    const garden = createInteractionGarden();
    const item = { id: 'moving-bed', type: 'structure' as const };
    const sourceRect = getItemRect(garden, item);

    if (!sourceRect) {
      throw new Error('Expected moving bed rect.');
    }

    const resizedRect = calculateResizeRect({
      currentPoint: { xFt: 0.12, yFt: 0.11 },
      garden,
      handle: 'northWest',
      originalRect: sourceRect,
    });
    const result = snapResizeRect({
      garden,
      handle: 'northWest',
      rect: resizedRect,
      snapExclusions: [item],
    });

    expect(result.rect).toMatchObject({
      depthFt: 3,
      widthFt: 4,
      xFt: 0,
      yFt: 0,
    });
    expect(result.guides).toEqual(
      expect.arrayContaining([
        { axis: 'x', valueFt: 0 },
        { axis: 'y', valueFt: 0 },
      ]),
    );
  });
});

function createInteractionGarden(): Garden {
  const springBed = labeledStructure(
    createDefaultStructure({
      id: 'spring-bed',
      type: 'raisedBed',
      xFt: 2,
      yFt: 2,
    }),
    'Spring bed',
    { depthFt: 2, widthFt: 4 },
  );
  const movingBed = labeledStructure(
    createDefaultStructure({
      id: 'moving-bed',
      type: 'raisedBed',
      xFt: 2,
      yFt: 1,
    }),
    'Moving bed',
    { depthFt: 2, widthFt: 2 },
  );
  const peaTrellis = labeledStructure(
    createDefaultStructure({
      id: 'pea-trellis',
      type: 'trellis',
      xFt: 7,
      yFt: 6,
    }),
    'Pea trellis',
    { depthFt: 0.5, widthFt: 4 },
  );

  return {
    ...createDefaultGarden('user-1'),
    plantings: [
      {
        ...createDefaultPlanting({
          id: 'tomato',
          label: 'Tomato',
          xFt: 4,
          yFt: 4,
        }),
        matureSpreadInches: 12,
      },
    ],
    structures: [springBed, movingBed, peaTrellis],
  };
}

function labeledStructure(
  structure: Structure,
  label: string,
  size: { depthFt: number; widthFt: number },
): Structure {
  return {
    ...structure,
    depthFt: size.depthFt,
    label,
    widthFt: size.widthFt,
  };
}
