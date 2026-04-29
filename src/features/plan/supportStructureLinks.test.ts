import {
  createDefaultGarden,
  createDefaultPlanting,
  createDefaultStructure,
} from '../../domain/gardens/GardenRepository';
import { getPlanItemKey, type PlanItemRef } from './planInteractionGeometry';
import {
  canMoveLinkedStructure,
  expandLinkedSupportSelection,
} from './supportStructureLinks';

describe('supportStructureLinks', () => {
  it('expands movable linked plantings and trellises into one drag selection', () => {
    const garden = {
      ...createDefaultGarden('user-a'),
      plantings: [
        {
          ...createDefaultPlanting({
            id: 'cucumber-1',
            label: 'Cucumber',
            xFt: 4,
            yFt: 4,
          }),
          supportStructureIds: ['trellis-1'],
        },
      ],
      structures: [
        createDefaultStructure({
          id: 'trellis-1',
          type: 'trellis',
          xFt: 3,
          yFt: 3,
        }),
      ],
    };
    const selection: PlanItemRef[] = [{ id: 'cucumber-1', type: 'planting' }];

    expect(
      expandLinkedSupportSelection(garden, selection).map(getPlanItemKey),
    ).toEqual(['planting:cucumber-1:group', 'structure:trellis-1']);
  });

  it('does not allow a trellis linked to an anchored planting to move alone', () => {
    const garden = {
      ...createDefaultGarden('user-a'),
      plantings: [
        {
          ...createDefaultPlanting({
            id: 'grape-1',
            label: 'Grape',
            xFt: 4,
            yFt: 4,
          }),
          plantedOn: '2026-04-20',
          status: 'planted' as const,
          supportStructureIds: ['trellis-1'],
        },
      ],
      structures: [
        createDefaultStructure({
          id: 'trellis-1',
          type: 'trellis',
          xFt: 3,
          yFt: 3,
        }),
      ],
    };

    expect(canMoveLinkedStructure(garden, 'trellis-1')).toBe(false);
    expect(
      expandLinkedSupportSelection(garden, [
        { id: 'trellis-1', type: 'structure' },
      ]),
    ).toEqual([]);
  });
});
