import {
  createDefaultGarden,
  createDefaultPlanting,
  createDefaultStructure,
} from '../../domain/gardens/GardenRepository';
import { buildMaterialsList } from './materialsList';

describe('buildMaterialsList', () => {
  it('summarizes beds, paths, trellises, and crop support needs', () => {
    const garden = {
      ...createDefaultGarden('user-a'),
      plantings: [
        {
          ...createDefaultPlanting({
            id: 'tomato-1',
            label: 'Tomato',
            xFt: 3,
            yFt: 3,
          }),
          cropId: 'tomato',
          plantCount: 2,
          support: {
            installedAtIso: null,
            notes: '',
            perPlant: true,
            quantity: 2,
            required: true,
            type: 'cage' as const,
          },
        },
      ],
      structures: [
        createDefaultStructure({
          id: 'bed-1',
          type: 'raisedBed',
          xFt: 1,
          yFt: 1,
        }),
        {
          ...createDefaultStructure({
            accessibleMode: true,
            id: 'path-1',
            type: 'pathway',
            xFt: 0,
            yFt: 5,
          }),
          material: 'gravel' as const,
        },
        createDefaultStructure({
          id: 'trellis-1',
          type: 'trellis',
          xFt: 1,
          yFt: 0,
        }),
      ],
    };

    const materials = buildMaterialsList(garden);

    expect(materials.beds).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: 'Raised bed',
          summary: expect.stringContaining('8 by 4 ft'),
        }),
      ]),
    );
    expect(materials.paths).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: 'Pathway',
          summary: expect.stringContaining('32 sq ft Gravel'),
        }),
      ]),
    );
    expect(materials.supports).toEqual(
      expect.arrayContaining([
        expect.stringContaining('Tomato'),
        expect.stringContaining('2 cages'),
        expect.stringContaining('8 ft saved trellis'),
      ]),
    );
    expect(materials.addOns).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: 'Raised bed mulch',
          type: 'mulch',
        }),
      ]),
    );
    expect(materials.totals).toEqual(
      expect.arrayContaining([
        expect.stringContaining('1 trellis structure'),
        expect.stringContaining('32 sq ft Gravel path surface'),
      ]),
    );
  });
});
