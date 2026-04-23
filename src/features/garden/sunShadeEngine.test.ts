import {
  createDefaultGarden,
  createDefaultPlanting,
  createDefaultStructure,
} from '../../domain/gardens/GardenRepository';
import {
  buildSunShadeLayers,
  cropSunRequirementMet,
  createManualSunArea,
  findSunShadeLayer,
} from './sunShadeEngine';
import { describeCropSunFit } from './sunShadeFit';

describe('sunShadeEngine', () => {
  it('computes seasonal sun/shade cells from garden location and trellis structures', () => {
    const garden = {
      ...createDefaultGarden('user-a'),
      structures: [
        createDefaultStructure({
          id: 'fence-1',
          type: 'fenceWall',
          xFt: 2,
          yFt: 1,
        }),
      ],
    };

    const layers = buildSunShadeLayers(garden);

    expect(layers).toHaveLength(3);
    expect(layers[0]?.areas).toHaveLength(
      garden.plot.widthFt * garden.plot.depthFt,
    );
    expect(
      layers
        .flatMap((layer) => layer.areas)
        .every((area) => area.sunHours >= 0),
    ).toBe(true);
  });

  it('preserves manual cell overrides when recalculating modeled layers', () => {
    const garden = createDefaultGarden('user-a');
    const manualArea = createManualSunArea('summer', 2, 2, 'fullShade');
    const layer = findSunShadeLayer(garden, 'summer');

    const layers = buildSunShadeLayers({
      ...garden,
      sunShadeLayers: [
        {
          ...layer,
          observedOn: '2026-04-20',
          areas: layer.areas.map((area) =>
            area.xFt === manualArea.xFt && area.yFt === manualArea.yFt
              ? manualArea
              : area,
          ),
        },
      ],
    });

    expect(
      layers
        .find((candidate) => candidate.season === 'summer')
        ?.areas.find((area) => area.xFt === 2 && area.yFt === 2),
    ).toMatchObject({
      exposure: 'fullShade',
      source: 'manual',
    });
    expect(
      layers.find((candidate) => candidate.season === 'summer')?.observedOn,
    ).toBe('2026-04-20');
  });

  it('evaluates crop sun requirements against a modeled cell', () => {
    expect(cropSunRequirementMet('fullSun', 'partShade')).toBe(false);
    expect(cropSunRequirementMet('partShade', 'partSun')).toBe(true);
    expect(
      describeCropSunFit('fullSun', {
        exposure: 'partSun',
        source: 'modeled',
        sunHours: 5,
      }).label,
    ).toBe('sun check');
    expect(
      describeCropSunFit('fullSun', {
        exposure: 'fullShade',
        source: 'modeled',
        sunHours: 1,
      }).label,
    ).toBe('sun mismatch');
    expect(
      describeCropSunFit('partSun', {
        exposure: 'fullSun',
        source: 'manual',
        sunHours: 7,
      }).label,
    ).toBe('sun ready');
  });

  it('explains tall-crop shade differently from saved-source or structure shade', () => {
    const fit = describeCropSunFit('fullSun', {
      exposure: 'partShade',
      shadeSources: [
        {
          heightFt: 7,
          itemId: 'tomato-line',
          itemType: 'planting',
          kind: 'trellisedCrop',
          label: 'Tomato line',
        },
      ],
      source: 'modeled',
      sunHours: 3,
    });

    expect(fit.level).toBe('underperform');
    expect(fit.action).toContain('trellised-crop shade from Tomato line');
  });

  it('records shade sources and microclimate notes from tall crops and hardscape', () => {
    const garden = {
      ...createDefaultGarden('user-a'),
      plantings: [
        {
          ...createDefaultPlanting({
            id: 'tomato-line',
            label: 'Tomato line',
            xFt: 5,
            yFt: 3,
          }),
          cropId: 'tomato',
          matureHeightInches: 84,
          mode: 'trellisLine' as const,
          rowLengthFt: 4,
          status: 'planted' as const,
          trellisLengthFt: 4,
        },
      ],
      plot: {
        ...createDefaultGarden('user-a').plot,
        depthFt: 8,
        widthFt: 10,
      },
      structures: [
        {
          ...createDefaultStructure({
            id: 'stone-path',
            type: 'pathway',
            xFt: 0,
            yFt: 0,
          }),
          depthFt: 8,
          material: 'stone' as const,
          widthFt: 1,
        },
      ],
    };

    const areas = buildSunShadeLayers(garden).flatMap((layer) => layer.areas);
    const tomatoSources = areas
      .flatMap((area) => area.shadeSources ?? [])
      .filter((source) => source.itemId === 'tomato-line');

    expect(
      tomatoSources.some((source) => source.kind === 'trellisedCrop'),
    ).toBe(true);
    expect(tomatoSources[0]).toMatchObject({
      canopyDensity: 'moderate',
      growthStage: 'mature',
      matureHeightFt: 7,
    });
    expect(tomatoSources[0]?.canopyOpacity).toBeGreaterThan(0);
    expect(
      areas
        .filter((area) =>
          area.shadeSources?.some((source) => source.itemId === 'tomato-line'),
        )
        .some((area) => area.sunHours > 0),
    ).toBe(true);
    expect(
      areas.some((area) =>
        area.microclimateNotes?.some(
          (note) => note.kind === 'westHeat' || note.kind === 'reflectedHeat',
        ),
      ),
    ).toBe(true);
  });
});
