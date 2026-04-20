import {
  createDefaultGarden,
  createDefaultStructure,
} from '../../domain/gardens/GardenRepository';
import {
  buildSunShadeLayers,
  cropSunRequirementMet,
  createManualSunArea,
  findSunShadeLayer,
} from './sunShadeEngine';

describe('sunShadeEngine', () => {
  it('computes seasonal sun/shade cells from garden location and obstacles', () => {
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
  });

  it('evaluates crop sun requirements against a modeled cell', () => {
    expect(cropSunRequirementMet('fullSun', 'partShade')).toBe(false);
    expect(cropSunRequirementMet('partShade', 'partSun')).toBe(true);
  });
});
