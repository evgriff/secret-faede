import { getCropById } from '../../domain/crops/cropCatalog';
import {
  annArborClimateProfile,
  createDefaultGarden,
  type SeasonCropSelection,
} from '../../domain/gardens/GardenRepository';
import {
  buildSeasonCropLayoutRequests,
  getSeasonCropFitSignal,
} from './seasonCropPlan';

describe('season crop plan', () => {
  it('keeps wanted crop order while building optimizer-ready layout requests', () => {
    const garden = {
      ...createDefaultGarden('user-a'),
      climateProfile: {
        ...annArborClimateProfile,
        source: 'user' as const,
      },
      seasonPlan: {
        updatedAtIso: '2026-04-21T12:00:00.000Z',
        wantedCrops: [
          makeSelection({
            cropId: 'basil',
            id: 'season-basil',
          }),
          makeSelection({
            cropId: 'tomato',
            id: 'season-tomato',
            quantity: 4,
          }),
        ],
      },
    };

    const requests = buildSeasonCropLayoutRequests(garden, 'fullSun');

    expect(requests.map((request) => request.cropId)).toEqual([
      'basil',
      'tomato',
    ]);
    const tomatoRequest = requests[1];

    if (!tomatoRequest) {
      throw new Error('Expected the tomato season crop layout request.');
    }

    expect(tomatoRequest).toMatchObject({
      quantity: 4,
    });
    expect(tomatoRequest).not.toHaveProperty('mustGrow');
    expect(tomatoRequest).not.toHaveProperty('priority');
    expect(tomatoRequest).not.toHaveProperty('rank');
    expect(tomatoRequest.estimatedAreaSqFt).toBeGreaterThan(0);
  });

  it('holds unsupported trellis crops for review', () => {
    const poleBean = getCropById('pole-bean');

    expect(poleBean?.trellisRequired).toBe(true);

    const garden = {
      ...createDefaultGarden('user-a'),
      seasonPlan: {
        updatedAtIso: null,
        wantedCrops: [
          makeSelection({
            cropId: 'pole-bean',
            id: 'season-pole-bean',
            supportAllowed: false,
          }),
        ],
      },
    };

    const [request] = buildSeasonCropLayoutRequests(garden, 'fullSun');

    expect(request?.fit.level).toBe('unlikelyFit');
    expect(request?.fit.groupedReasons).toContainEqual(
      expect.objectContaining({
        group: 'support',
        severity: 'blocker',
      }),
    );
    expect(request?.fit.reasons.join(' ')).toContain('Support');
  });

  it('uses spacing overrides when estimating wanted crop footprints', () => {
    const garden = {
      ...createDefaultGarden('user-a'),
      seasonPlan: {
        updatedAtIso: null,
        wantedCrops: [
          makeSelection({
            cropId: 'tomato',
            id: 'season-tomato-default',
            quantity: 4,
          }),
          makeSelection({
            cropId: 'tomato',
            id: 'season-tomato-compact',
            quantity: 4,
            spacingOverrideInches: 12,
          }),
        ],
      },
    };

    const [defaultRequest, compactRequest] =
      buildSeasonCropLayoutRequests(garden);

    expect(compactRequest?.spacingOverrideInches).toBe(12);
    expect(compactRequest?.estimatedAreaSqFt).toBeLessThan(
      defaultRequest?.estimatedAreaSqFt ?? 0,
    );
  });

  it('uses workable language when fit is based on partial crop data', () => {
    const lettuce = getCropById('lettuce');

    if (!lettuce) {
      throw new Error('Expected lettuce in the checked-in crop catalog.');
    }

    const garden = {
      ...createDefaultGarden('user-a'),
      seasonPlan: {
        updatedAtIso: null,
        wantedCrops: [],
      },
    };
    const fit = getSeasonCropFitSignal({
      crop: {
        ...lettuce,
        completenessScore: 0.78,
        profileCompleteness: 'partial',
      },
      garden,
      selection: makeSelection({
        cropId: 'lettuce',
        id: 'season-lettuce',
        plantingForm: lettuce.supportedPlantingModes[0] ?? 'single',
      }),
      sunExposureAtPlacement: 'fullSun',
    });

    expect(fit.level).toBe('workable');
    expect(fit.uncertainty).toContain('partial');
    expect(fit.summary).toContain('workable');
  });

  it('groups sun and space constraints without generic caution spam', () => {
    const lettuce = getCropById('lettuce');

    if (!lettuce) {
      throw new Error('Expected lettuce in the checked-in crop catalog.');
    }

    const garden = {
      ...createDefaultGarden('user-a'),
      plot: {
        ...createDefaultGarden('user-a').plot,
        depthFt: 4,
        widthFt: 4,
      },
      seasonPlan: {
        updatedAtIso: null,
        wantedCrops: [],
      },
    };
    const fit = getSeasonCropFitSignal({
      crop: {
        ...lettuce,
        matureSpreadInches: 12,
        rowSpacingInches: 12,
        spacingInches: 12,
        sunRequirement: 'fullSun',
      },
      garden,
      selection: makeSelection({
        cropId: 'lettuce',
        id: 'season-lettuce',
        plantingForm: lettuce.supportedPlantingModes[0] ?? 'single',
        quantity: 6,
      }),
      sunExposureAtPlacement: 'fullShade',
    });

    expect(fit.level).toBe('caution');
    expect(fit.groupedReasons.map((reason) => reason.group)).toEqual([
      'sun',
      'space',
    ]);
    expect(fit.reasons).toEqual([
      expect.stringContaining('Sun:'),
      expect.stringContaining('Space:'),
    ]);
  });
});

function makeSelection(
  values: Partial<SeasonCropSelection>,
): SeasonCropSelection {
  return {
    cropId: 'tomato',
    id: 'season-tomato',
    plantingForm: 'single',
    notes: '',
    supportAllowed: true,
    quantity: 1,
    spacingOverrideInches: null,
    varietyName: '',
    ...values,
  };
}
