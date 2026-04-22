import {
  createDefaultGarden,
  createDefaultPlanting,
  createDefaultStructure,
} from '../../domain/gardens/GardenRepository';
import { findPlanWarnings } from './gardenPlanning';

describe('garden access rules', () => {
  it('treats blocked primary paths and compost placement conflicts as real access issues', () => {
    const garden = {
      ...createDefaultGarden('user-a'),
      plantings: [
        {
          ...createDefaultPlanting({
            id: 'lettuce-1',
            label: 'Lettuce',
            xFt: 5,
            yFt: 4,
          }),
          spacingInches: 24,
        },
      ],
      structures: [
        {
          ...createDefaultStructure({
            id: 'path-main',
            type: 'pathway',
            xFt: 4,
            yFt: 0,
          }),
          continuousPath: true,
          label: 'Main path',
        },
        {
          ...createDefaultStructure({
            id: 'compost-1',
            type: 'compost',
            xFt: 4.5,
            yFt: 2,
          }),
          label: 'Compost bay',
        },
      ],
    };

    const warnings = findPlanWarnings(garden);

    expect(warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'pathway-lettuce-1-path-main',
          severity: 'critical',
          title: 'Primary path blocked',
        }),
        expect.objectContaining({
          id: 'structure-compost-compost-1-path-main',
          title: 'Compost blocks access',
        }),
      ]),
    );
  });
});
