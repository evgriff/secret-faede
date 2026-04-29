import { getCropById } from '../../domain/crops/cropCatalog';
import {
  annArborClimateProfile,
  createDefaultGarden,
  createDefaultPlanting,
  type Garden,
} from '../../domain/gardens/GardenRepository';
import {
  getPlantingFootprint,
  getStructureFootprint,
  rectsOverlap,
} from '../garden/gardenPlanning';
import { isRectInsidePlot } from '../garden/gardenPlanningGeometry';
import {
  scoreSunAreaFit,
  scoreSunFit,
  scoreSunFootprintFit,
} from './autoLayoutScoring';
import { getLegalSupportFootprint } from './autoLayoutConstraints';
import { generateAutoLayoutCandidates } from './autoLayoutEngine';
import {
  createLayoutFixture,
  createSunLayer,
  makeSeasonSelection,
} from './autoLayoutTestFixtures';

describe('auto layout engine', () => {
  it('generates deterministic feasible candidates from wanted crops', () => {
    const garden = createLayoutFixture();
    const sunLayer = createSunLayer(garden);
    const firstRun = generateAutoLayoutCandidates(garden, { sunLayer });
    const secondRun = generateAutoLayoutCandidates(garden, { sunLayer });

    expect(firstRun).toHaveLength(3);
    expect(new Set(firstRun.map((candidate) => candidate.id))).toEqual(
      new Set(['auto-sunFirst', 'auto-supportFirst', 'auto-accessFirst']),
    );
    expect(
      firstRun.map((candidate) =>
        candidate.plantings.map((planting) => [
          planting.label,
          planting.xFt,
          planting.yFt,
        ]),
      ),
    ).toEqual(
      secondRun.map((candidate) =>
        candidate.plantings.map((planting) => [
          planting.label,
          planting.xFt,
          planting.yFt,
        ]),
      ),
    );
    expect(
      new Set(
        firstRun.map((candidate) =>
          candidate.plantings
            .map(
              (planting) => `${planting.label}:${planting.xFt}:${planting.yFt}`,
            )
            .join('|'),
        ),
      ).size,
    ).toBeGreaterThan(1);

    for (const candidate of firstRun) {
      expect(candidate.hardConstraintViolations).toEqual([]);
      expect(candidate.search.evaluatedStates).toBeGreaterThanOrEqual(1);
      expect(candidate.search.maxDepth).toBe(4);
      expect(candidate.plantings.length).toBeGreaterThanOrEqual(3);
      expect(
        candidate.plantings.some(
          (planting) =>
            planting.label.startsWith('Tomato') &&
            planting.support.type === 'none',
        ),
      ).toBe(true);
      expect(
        candidate.structures.some((structure) => structure.type === 'trellis'),
      ).toBe(false);
      expectNoPlantingOverlaps(candidate.plantings);
    }
  });

  it('adds true trellises as grid structures for vining crops', () => {
    const garden = {
      ...createLayoutFixture(),
      seasonPlan: {
        updatedAtIso: '2026-04-21T12:00:00.000Z',
        wantedCrops: [
          makeSeasonSelection({
            cropId: 'cucumber',
            id: 'season-cucumber',
            plantingForm: 'trellisLine',
            quantity: 2,
            supportAllowed: true,
          }),
        ],
      },
    };
    const [candidate] = generateAutoLayoutCandidates(garden, {
      sunLayer: createSunLayer(garden),
    });
    const cucumber = candidate?.plantings.find((planting) =>
      planting.label.startsWith('Cucumber'),
    );
    const trellis = candidate?.structures.find(
      (structure) => structure.type === 'trellis',
    );

    expect(candidate?.hardConstraintViolations).toEqual([]);
    expect(cucumber?.support.type).toBe('none');
    expect(cucumber?.supportStructureIds).toEqual([trellis?.id]);
    expect(trellis).toEqual(
      expect.objectContaining({
        label: expect.stringContaining('Cucumber'),
        type: 'trellis',
      }),
    );
  });

  it('keeps generated plantings and trellis structures clear of access paths', () => {
    const garden = createLayoutFixture();
    const [candidate] = generateAutoLayoutCandidates(garden, {
      sunLayer: createSunLayer(garden),
    });
    const path = garden.structures.find(
      (structure) => structure.type === 'pathway',
    );

    if (!candidate || !path) {
      throw new Error('Expected a candidate and saved path.');
    }

    const pathFootprint = getStructureFootprint(path);

    expect(candidate.hardConstraintViolations).toEqual([]);

    for (const planting of candidate.plantings) {
      expect(rectsOverlap(getPlantingFootprint(planting), pathFootprint)).toBe(
        false,
      );
    }

    for (const structure of candidate.structures) {
      const footprint = getStructureFootprint(structure);

      expect(isRectInsidePlot(footprint, garden.plot)).toBe(true);
      expect(rectsOverlap(footprint, pathFootprint)).toBe(false);
    }
  });

  it('treats partial-sun crops as better fits in partial sun than full sun', () => {
    const lettuce = getCropById('lettuce');

    if (!lettuce) {
      throw new Error('Expected lettuce in crop catalog.');
    }

    expect(lettuce.sunRequirement).toBe('partSun');
    expect(scoreSunFit(lettuce, 'partSun')).toBeGreaterThan(
      scoreSunFit(lettuce, 'fullSun'),
    );
  });

  it('penalizes full-sun placements when tall crops are the shade source', () => {
    const tomato = getCropById('tomato');

    if (!tomato) {
      throw new Error('Expected tomato in crop catalog.');
    }

    const plainPartSun = scoreSunAreaFit(tomato, {
      depthFt: 1,
      exposure: 'partSun',
      id: 'plain',
      source: 'modeled',
      sunHours: 5,
      widthFt: 1,
      xFt: 0,
      yFt: 0,
    });
    const tallCropPartSun = scoreSunAreaFit(tomato, {
      depthFt: 1,
      exposure: 'partSun',
      id: 'tall-shade',
      shadeSources: [
        {
          heightFt: 7,
          itemId: 'corn-row',
          itemType: 'planting',
          kind: 'tallCrop',
          label: 'Corn row',
        },
      ],
      source: 'modeled',
      sunHours: 5,
      widthFt: 1,
      xFt: 0,
      yFt: 0,
    });

    expect(tallCropPartSun).toBeLessThan(plainPartSun);
  });

  it('scores sun fit across the whole planting footprint', () => {
    const tomato = getCropById('tomato');

    if (!tomato) {
      throw new Error('Expected tomato in crop catalog.');
    }

    const planting = {
      ...createDefaultPlanting({
        id: 'wide-tomato',
        label: 'Wide tomato',
        xFt: 1,
        yFt: 0.5,
      }),
      blockDepthFt: 1,
      blockWidthFt: 2,
      cropId: tomato.id,
      mode: 'block' as const,
    };
    const layer = {
      ...createSunLayer(createLayoutFixture()),
      areas: [
        {
          depthFt: 1,
          exposure: 'partSun' as const,
          id: 'part-sun',
          source: 'manual' as const,
          sunHours: 5,
          widthFt: 1,
          xFt: 0,
          yFt: 0,
        },
        {
          depthFt: 1,
          exposure: 'fullSun' as const,
          id: 'full-sun',
          source: 'manual' as const,
          sunHours: 7,
          widthFt: 1,
          xFt: 1,
          yFt: 0,
        },
      ],
    };

    expect(scoreSunFootprintFit(tomato, layer, planting)).toBeLessThan(
      scoreSunFit(tomato, 'fullSun'),
    );
  });

  it('does not fake a trellis location when adjacent support space is blocked', () => {
    const cucumber = getCropById('cucumber');

    if (!cucumber) {
      throw new Error('Expected cucumber in crop catalog.');
    }

    const garden = {
      ...createDefaultGarden('user-a'),
      plot: {
        ...createDefaultGarden('user-a').plot,
        depthFt: 3,
        widthFt: 4,
      },
    };
    const cropFootprint = {
      depthFt: 1,
      id: 'cucumber-row',
      itemType: 'planting' as const,
      label: 'Cucumber row',
      widthFt: 2,
      xFt: 1,
      yFt: 0,
    };
    const blockedFootprint = {
      ...cropFootprint,
      id: 'blocked-row',
      label: 'Blocked row',
      yFt: 1,
    };

    expect(
      getLegalSupportFootprint(garden, cucumber, cropFootprint, 'trellis', [
        blockedFootprint,
      ]),
    ).toBeNull();
  });

  it('keeps unsupported trellis crops out of illegal layouts', () => {
    const baseGarden = createLayoutFixture();
    const garden = {
      ...baseGarden,
      seasonPlan: {
        ...baseGarden.seasonPlan,
        wantedCrops: baseGarden.seasonPlan.wantedCrops.map((selection) =>
          selection.cropId === 'tomato'
            ? {
                ...selection,
                cropId: 'pole-bean',
                id: 'season-pole-bean',
                supportAllowed: false,
              }
            : selection,
        ),
      },
    };
    const [candidate] = generateAutoLayoutCandidates(garden, {
      sunLayer: createSunLayer(garden),
    });

    expect(candidate?.unplaced).toContainEqual(
      expect.objectContaining({
        cropName: 'Pole bean',
        reason: 'Support was disabled for a crop that needs it.',
      }),
    );
    expect(candidate?.hardConstraintViolations).toEqual([]);
  });

  it('works around planted crops instead of moving them', () => {
    const garden = {
      ...createLayoutFixture(),
      plantings: [
        {
          ...createDefaultPlanting({
            id: '[auto-layout]-spring-lettuce',
            label: 'Spring lettuce',
            xFt: 2,
            yFt: 2,
          }),
          matureSpreadInches: 36,
          notes: '[auto-layout] already planted',
          status: 'growing' as const,
        },
      ],
    };
    const [candidate] = generateAutoLayoutCandidates(garden, {
      sunLayer: createSunLayer(garden),
    });
    const anchored = garden.plantings[0];

    if (!anchored) {
      throw new Error('Expected anchored planting.');
    }

    const anchoredFootprint = getPlantingFootprint(anchored);

    expect(candidate?.tradeoffs).toEqual(
      expect.arrayContaining([expect.stringContaining('stayed anchored')]),
    );
    expect(
      candidate?.plantings.some((planting) =>
        rectsOverlap(getPlantingFootprint(planting), anchoredFootprint),
      ),
    ).toBe(false);
  });

  it('does not let future succession timing create a false simultaneous block', () => {
    const garden = {
      ...createDefaultGarden('user-a'),
      climateProfile: {
        ...annArborClimateProfile,
        source: 'user' as const,
      },
      plantings: [
        {
          ...createDefaultPlanting({
            id: 'future-lettuce',
            label: 'Future lettuce',
            xFt: 1,
            yFt: 1,
          }),
          blockDepthFt: 2,
          blockWidthFt: 2,
          cropId: 'lettuce',
          mode: 'block' as const,
          plannedFor: '2026-10-01',
          status: 'planned' as const,
        },
      ],
      plot: {
        ...createDefaultGarden('user-a').plot,
        depthFt: 2,
        widthFt: 2,
      },
      seasonPlan: {
        updatedAtIso: '2026-04-21T12:00:00.000Z',
        wantedCrops: [
          makeSeasonSelection({
            cropId: 'basil',
            id: 'season-basil',
            plantingForm: 'single',
            quantity: 1,
          }),
        ],
      },
      structures: [],
    };
    const [candidate] = generateAutoLayoutCandidates(garden);

    expect(candidate?.plantings).toHaveLength(1);
    expect(candidate?.hardConstraintViolations).toEqual([]);
  });

  it('tracks optimizer breakdown by access, spacing, structures, and water', () => {
    const garden = createLayoutFixture();
    const [candidate] = generateAutoLayoutCandidates(garden, {
      sunLayer: createSunLayer(garden),
    });
    if (!candidate) {
      throw new Error('Expected a generated candidate.');
    }

    expect(candidate.scoreBreakdown).toMatchObject({
      accessQuality: expect.any(Number),
      spacingQuality: expect.any(Number),
      structureCompatibility: expect.any(Number),
      waterGrouping: expect.any(Number),
    });
    expect(Object.keys(candidate.scoreBreakdown).sort()).toEqual([
      'accessQuality',
      'spacingQuality',
      'structureCompatibility',
      'waterGrouping',
    ]);
    expect('shadeManagement' in candidate.scoreBreakdown).toBe(false);
  });
});

function expectNoPlantingOverlaps(plantings: Garden['plantings']) {
  for (let leftIndex = 0; leftIndex < plantings.length; leftIndex += 1) {
    for (
      let rightIndex = leftIndex + 1;
      rightIndex < plantings.length;
      rightIndex += 1
    ) {
      const left = plantings[leftIndex];
      const right = plantings[rightIndex];

      if (!left || !right) {
        continue;
      }

      expect(
        rectsOverlap(getPlantingFootprint(left), getPlantingFootprint(right)),
      ).toBe(false);
    }
  }
}
