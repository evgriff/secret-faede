import {
  detroitClimateProfile,
  createDefaultGarden,
  type Garden,
  type SeasonCropSelection,
  type SunExposure,
  type SunShadeLayer,
} from '../../domain/gardens/GardenRepository';

export function createLayoutFixture(
  tomatoOverrides: Partial<SeasonCropSelection> = {},
): Garden {
  return {
    ...createDefaultGarden('user-a'),
    climateProfile: {
      ...detroitClimateProfile,
      source: 'user',
    },
    plot: {
      ...createDefaultGarden('user-a').plot,
      depthFt: 8,
      widthFt: 12,
    },
    seasonPlan: {
      updatedAtIso: '2026-04-21T12:00:00.000Z',
      wantedCrops: [
        makeSeasonSelection({
          cropId: 'tomato',
          id: 'season-tomato',
          plantingForm: 'trellisLine',
          supportAllowed: true,
          quantity: 2,
          ...tomatoOverrides,
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
      ],
    },
    structures: [
      {
        accessiblePath: false,
        canopyRadiusFt: null,
        continuousPath: false,
        depthFt: 4,
        drainageProfile: 'normal',
        heightFt: 1.5,
        id: 'bed-north',
        irrigationZone: null,
        label: 'North bed',
        locked: false,
        material: 'lumber',
        mulched: false,
        notes: '',
        rotationDegrees: 0,
        soilType: 'loam',
        type: 'raisedBed',
        widthFt: 8,
        workingClearanceFt: 2,
        xFt: 0,
        yFt: 0,
      },
      {
        accessiblePath: false,
        canopyRadiusFt: null,
        continuousPath: false,
        depthFt: 4,
        drainageProfile: 'normal',
        heightFt: 1.5,
        id: 'bed-south',
        irrigationZone: null,
        label: 'South bed',
        locked: false,
        material: 'lumber',
        mulched: false,
        notes: '',
        rotationDegrees: 0,
        soilType: 'loam',
        type: 'raisedBed',
        widthFt: 8,
        workingClearanceFt: 2,
        xFt: 0,
        yFt: 4,
      },
      {
        accessiblePath: false,
        canopyRadiusFt: null,
        continuousPath: true,
        depthFt: 8,
        drainageProfile: 'normal',
        heightFt: null,
        id: 'path-east',
        irrigationZone: null,
        label: 'East path',
        locked: false,
        material: 'woodChips',
        mulched: false,
        notes: '',
        rotationDegrees: 0,
        soilType: 'unknown',
        type: 'pathway',
        widthFt: 3,
        workingClearanceFt: null,
        xFt: 8.5,
        yFt: 0,
      },
    ],
  };
}

export function makeSeasonSelection(
  values: Partial<SeasonCropSelection>,
): SeasonCropSelection {
  return {
    cropId: 'tomato',
    id: 'season-tomato',
    plantingForm: 'single',
    notes: '',
    supportAllowed: true,
    quantity: 1,
    varietyName: '',
    ...values,
  };
}

export function createSunLayer(garden: Garden): SunShadeLayer {
  const exposures: SunExposure[] = ['partSun', 'partSun', 'fullSun', 'fullSun'];

  return {
    areas: Array.from({ length: garden.plot.depthFt }, (_, yFt) =>
      Array.from({ length: garden.plot.widthFt }, (_, xFt) => {
        const exposure =
          exposures[Math.min(Math.floor(xFt / 3), 3)] ?? 'fullSun';

        return {
          depthFt: 1,
          exposure,
          id: `summer-${xFt}-${yFt}`,
          source: 'manual' as const,
          sunHours: exposure === 'fullSun' ? 7 : 5,
          widthFt: 1,
          xFt,
          yFt,
        };
      }),
    ).flat(),
    cellSizeFt: 1,
    fullSunHours: null,
    gardenId: garden.id,
    generatedAtIso: null,
    id: 'sun-summer',
    label: 'Summer peak',
    modelVersion: 'test',
    observedOn: null,
    representativeDate: '06-21',
    season: 'summer',
  };
}
