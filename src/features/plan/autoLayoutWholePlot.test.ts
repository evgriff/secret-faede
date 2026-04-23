import { describe, expect, it } from 'vitest';

import {
  createDefaultGarden,
  type Garden,
} from '../../domain/gardens/GardenRepository';
import {
  getPlantingFootprint,
  getStructureFootprint,
  rectsOverlap,
} from '../garden/gardenPlanning';
import { generateAutoLayoutCandidates } from './autoLayoutEngine';
import { createSunLayer, makeSeasonSelection } from './autoLayoutTestFixtures';

describe('auto layout whole-plot planning', () => {
  it('proposes a full plot with access path and compatible plant zones', () => {
    const garden = makeWholePlotGarden();
    const [candidate] = generateAutoLayoutCandidates(garden, {
      sunLayer: createSunLayer(garden),
    });

    if (!candidate) {
      throw new Error('Expected a generated whole-plot plan.');
    }

    const path = candidate.structures.find(
      (structure) => structure.type === 'pathway',
    );
    const tomato = candidate.plantings.find((planting) =>
      planting.label.startsWith('Tomato'),
    );
    const lettuce = candidate.plantings.find((planting) =>
      planting.label.startsWith('Lettuce'),
    );

    expect(path).toEqual(
      expect.objectContaining({
        continuousPath: true,
        label: 'Main access path',
        widthFt: 3,
      }),
    );
    expect(candidate.wholePlot.accessPathIds).toContain(path?.id);
    expect(candidate.wholePlot.plantZones.length).toBeGreaterThanOrEqual(2);
    expect(candidate.wholePlot.heuristics).toEqual(
      expect.arrayContaining([
        expect.stringContaining('access path'),
        expect.stringContaining('tall or trellised crop group'),
      ]),
    );

    if (!path || !tomato || !lettuce) {
      throw new Error('Expected path, tomato, and lettuce in plan.');
    }

    for (const planting of candidate.plantings) {
      expect(
        rectsOverlap(
          getPlantingFootprint(planting),
          getStructureFootprint(path),
        ),
      ).toBe(false);
    }

    expect(tomato.yFt).toBeLessThanOrEqual(lettuce.yFt);
  });
});

function makeWholePlotGarden(): Garden {
  return {
    ...createDefaultGarden('whole-plot-user'),
    seasonPlan: {
      updatedAtIso: '2026-04-21T12:00:00.000Z',
      wantedCrops: [
        makeSeasonSelection({
          cropId: 'tomato',
          id: 'season-tomato',
          plantingForm: 'trellisLine',
          quantity: 2,
          supportAllowed: true,
        }),
        makeSeasonSelection({
          cropId: 'lettuce',
          id: 'season-lettuce',
          plantingForm: 'block',
          quantity: 6,
        }),
        makeSeasonSelection({
          cropId: 'basil',
          id: 'season-basil',
          plantingForm: 'block',
          quantity: 2,
        }),
        makeSeasonSelection({
          cropId: 'carrot',
          id: 'season-carrot',
          plantingForm: 'block',
          quantity: 12,
        }),
      ],
    },
    structures: [],
  };
}
