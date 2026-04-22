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
  it('sorts wanted crops into optimizer-ready layout requests', () => {
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
            rank: 1,
          }),
          makeSelection({
            commitment: 'mustGrow',
            cropId: 'tomato',
            id: 'season-tomato',
            rank: 0,
            targetQuantity: 4,
          }),
        ],
      },
    };

    const requests = buildSeasonCropLayoutRequests(garden, 'fullSun');

    expect(requests.map((request) => request.cropId)).toEqual([
      'tomato',
      'basil',
    ]);
    const firstRequest = requests[0];

    if (!firstRequest) {
      throw new Error('Expected a first season crop layout request.');
    }

    expect(firstRequest).toMatchObject({
      mustGrow: true,
      targetQuantity: 4,
    });
    expect(firstRequest.estimatedAreaSqFt).toBeGreaterThan(0);
  });

  it('marks unsupported trellis crops as unlikely fit', () => {
    const tomato = getCropById('tomato');

    expect(tomato?.trellisRequired).toBe(true);

    const garden = {
      ...createDefaultGarden('user-a'),
      seasonPlan: {
        updatedAtIso: null,
        wantedCrops: [
          makeSelection({
            cropId: 'tomato',
            id: 'season-tomato',
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
        profileConfidence: 'partial',
      },
      garden,
      selection: makeSelection({
        cropId: 'lettuce',
        id: 'season-lettuce',
        modePreference: lettuce.supportedPlantingModes[0] ?? 'single',
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
        modePreference: lettuce.supportedPlantingModes[0] ?? 'single',
        targetQuantity: 6,
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
    commitment: 'niceToHave',
    containerAllowed: true,
    cropId: 'tomato',
    id: 'season-tomato',
    modePreference: 'single',
    notes: '',
    priority: 'medium',
    rank: 0,
    sowPreference: 'noPreference',
    supportAllowed: true,
    targetQuantity: 1,
    varietyName: '',
    ...values,
  };
}
