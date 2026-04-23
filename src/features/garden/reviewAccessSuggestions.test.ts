import {
  createDefaultGarden,
  createDefaultStructure,
  type Garden,
} from '../../domain/gardens/GardenRepository';
import {
  findPlanWarnings,
  getStructureFootprint,
  rectsOverlap,
} from './gardenPlanning';
import {
  applyReviewSuggestionActions,
  buildReviewSuggestions,
} from './reviewSuggestions';

describe('reviewAccessSuggestions', () => {
  it('adds an access path proposal for a bed with no reachable route', () => {
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
    const addPath = suggestions.find(
      (suggestion) => suggestion.type === 'addAccessPath',
    );

    expect(addPath).toBeDefined();

    const nextGarden = applyReviewSuggestionActions(
      garden,
      addPath?.actions ?? [],
    );

    expect(
      nextGarden.structures.some(
        (structure) =>
          structure.type === 'pathway' &&
          structure.id.includes('add-access-path-bed-1'),
      ),
    ).toBe(true);
  });

  it('offers a concrete move when a trellis blocks a path', () => {
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
    const clearPath = suggestions.find(
      (suggestion) => suggestion.type === 'clearPathway',
    );

    expect(clearPath).toBeDefined();

    const nextGarden = applyReviewSuggestionActions(
      garden,
      clearPath?.actions ?? [],
    );
    const path = nextGarden.structures.find(
      (structure) => structure.id === 'path-main',
    );
    const trellis = nextGarden.structures.find(
      (structure) => structure.id === 'pea-trellis',
    );

    if (!path || !trellis) {
      throw new Error('Expected path and trellis after applying suggestion.');
    }

    expect(
      rectsOverlap(getStructureFootprint(path), getStructureFootprint(trellis)),
    ).toBe(false);
  });
});
