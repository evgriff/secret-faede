import {
  createDefaultGarden,
  createDefaultPlanting,
  createDefaultStructure,
  type Garden,
  type Structure,
} from '../../domain/gardens/GardenRepository';
import {
  calculateResizeRect,
  defaultPlanSnapFt,
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
    expect(result.guides.map((guide) => guide.label)).toEqual(
      expect.arrayContaining(['plot left edge', 'plot top edge']),
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
    expect(result.guides.map((guide) => guide.label)).toEqual(
      expect.arrayContaining(['Spring bed right edge', 'Spring bed top edge']),
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
    expect(result.guides.map((guide) => guide.label)).toEqual(
      expect.arrayContaining([
        'Pea trellis centerline',
        'Pea trellis top edge',
      ]),
    );
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
    expect(result.guides.map((guide) => guide.label)).toContain(
      'Spring bed right edge',
    );
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
    expect(result.guides.map((guide) => guide.label)).toEqual(
      expect.arrayContaining(['plot left edge', 'plot top edge']),
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
