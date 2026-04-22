import {
  createDefaultGarden,
  createDefaultStructure,
  type Garden,
  type Structure,
} from '../../domain/gardens/GardenRepository';
import { buildAlignUpdates } from './planSelectionActions';

describe('planSelectionActions', () => {
  it('aligns selected items to right and bottom edges', () => {
    const garden = createSelectionGarden();
    const selection = [
      { id: 'bed-a', type: 'structure' as const },
      { id: 'bed-b', type: 'structure' as const },
    ];

    expect(buildAlignUpdates(garden, selection, 'right')).toEqual([
      { id: 'bed-a', type: 'structure', xFt: 6, yFt: 2 },
      { id: 'bed-b', type: 'structure', xFt: 5, yFt: 3 },
    ]);
    expect(buildAlignUpdates(garden, selection, 'bottom')).toEqual([
      { id: 'bed-a', type: 'structure', xFt: 1, yFt: 5 },
      { id: 'bed-b', type: 'structure', xFt: 5, yFt: 3 },
    ]);
  });
});

function createSelectionGarden(): Garden {
  return {
    ...createDefaultGarden('user-1'),
    structures: [
      sizedStructure(
        createDefaultStructure({
          id: 'bed-a',
          type: 'raisedBed',
          xFt: 1,
          yFt: 2,
        }),
        { depthFt: 2, widthFt: 2 },
      ),
      sizedStructure(
        createDefaultStructure({
          id: 'bed-b',
          type: 'raisedBed',
          xFt: 5,
          yFt: 3,
        }),
        { depthFt: 4, widthFt: 3 },
      ),
    ],
  };
}

function sizedStructure(
  structure: Structure,
  size: { depthFt: number; widthFt: number },
): Structure {
  return {
    ...structure,
    depthFt: size.depthFt,
    widthFt: size.widthFt,
  };
}
