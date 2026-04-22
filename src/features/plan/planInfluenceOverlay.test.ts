import {
  createDefaultGarden,
  createDefaultPlanting,
  type SunShadeLayer,
} from '../../domain/gardens/GardenRepository';
import { withPlantingInstances } from '../../domain/gardens/plantingInstances';
import type { PlanWarning } from '../garden/gardenPlanning';
import { buildPlanInfluenceOverlay } from './planInfluenceOverlay';

describe('planInfluenceOverlay', () => {
  it('builds contextual spacing and shade zones for the focused crop', () => {
    const tomato = withPlantingInstances({
      ...createDefaultPlanting({
        id: 'tomato-1',
        label: 'Tomato',
        xFt: 4,
        yFt: 3,
      }),
      cropId: 'tomato',
      matureHeightInches: 72,
      spacingInches: 24,
    });
    const lettuce = withPlantingInstances({
      ...createDefaultPlanting({
        id: 'lettuce-1',
        label: 'Lettuce',
        xFt: 5,
        yFt: 3,
      }),
      cropId: 'lettuce',
      spacingInches: 8,
    });
    const garden = {
      ...createDefaultGarden('user-1'),
      plantings: [tomato, lettuce],
    };
    const sunLayer: SunShadeLayer = {
      areas: [
        {
          depthFt: 1,
          exposure: 'partShade',
          id: 'summer-4-4',
          shadeSources: [
            {
              heightFt: 6,
              itemId: tomato.id,
              itemType: 'planting',
              kind: 'tallCrop',
              label: tomato.label,
            },
          ],
          source: 'modeled',
          sunHours: 3,
          widthFt: 1,
          xFt: 4,
          yFt: 4,
        },
      ],
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
    const warnings: PlanWarning[] = [
      {
        acknowledgeable: false,
        fix: 'Move one crop.',
        id: 'spacing-tomato-lettuce',
        itemIds: [tomato.id, lettuce.id],
        kind: 'spacing',
        message: 'Tomato and Lettuce need the same mature space.',
        severity: 'warning',
        title: 'Spacing collision',
      },
    ];

    const overlay = buildPlanInfluenceOverlay({
      focusKey: 'tomato',
      garden,
      sunLayer,
      warnings,
    });

    expect(overlay?.summary.keepAway).toBe(
      '1.0 ft keep-away radius from saved crop spacing',
    );
    expect(overlay?.summary.shade).toBe(
      '1 modeled shade cell from this crop in the active season',
    );
    expect(overlay?.summary.warnings).toEqual(['Spacing collision']);
    expect(overlay?.zones).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'spacing',
          warning: true,
          widthFt: 2,
        }),
        expect.objectContaining({
          kind: 'shade',
          warning: false,
          xFt: 4,
          yFt: 4,
        }),
      ]),
    );
  });
});
