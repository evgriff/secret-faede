import {
  createDefaultGarden,
  createDefaultStructure,
  type Garden,
} from '../../domain/gardens/GardenRepository';
import { findPlanWarnings } from './gardenPlanning';
import { buildReviewSuggestions } from './reviewSuggestions';

describe('reviewAccessSuggestions', () => {
  it('does not add access path proposals in the gardener-facing review flow', () => {
    const garden: Garden = {
      ...createDefaultGarden('user-a'),
      structures: [
        {
          ...createDefaultStructure({
            id: 'bed-1',
            type: 'raisedBed',
            xFt: 1,
            yFt: 1,
          }),
          label: 'Main bed',
        },
      ],
    };
    const suggestions = buildReviewSuggestions({
      garden,
      sunLayer: null,
      warnings: findPlanWarnings(garden),
    });
    expect(
      suggestions.some((suggestion) => suggestion.type === 'addAccessPath'),
    ).toBe(false);
  });

  it('does not offer path-clearing suggestions in the gardener-facing review flow', () => {
    const garden: Garden = {
      ...createDefaultGarden('user-a'),
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
            id: 'pea-trellis',
            type: 'trellis',
            xFt: 5,
            yFt: 2,
          }),
          depthFt: 0.5,
          label: 'Pea trellis',
          widthFt: 2,
        },
      ],
    };
    const suggestions = buildReviewSuggestions({
      garden,
      sunLayer: null,
      warnings: findPlanWarnings(garden),
    });
    expect(
      suggestions.some((suggestion) => suggestion.type === 'clearPathway'),
    ).toBe(false);
  });
});
