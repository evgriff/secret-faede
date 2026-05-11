import {
  detroitClimateProfile,
  detroitLocation,
  createDefaultGarden,
} from './GardenRepository';
import {
  createGardenFromSetup,
  gardenTemplates,
  type GardenSetupRequest,
} from './gardenTemplates';

describe('gardenTemplates', () => {
  it('defines credible starter templates', () => {
    expect(gardenTemplates.map((template) => template.id)).toEqual([
      'small-raised-bed',
      'patio-containers',
      'salad-garden',
      'feed-the-family',
      'pollinator-herb-mixed-bed',
    ]);
    expect(
      gardenTemplates.every((template) => template.structures.length > 0),
    ).toBe(true);
  });

  it('creates a real garden aggregate from a template', () => {
    const garden = createGardenFromSetup(
      createDefaultGarden('user-a'),
      setupRequest('small-raised-bed'),
    );

    expect(garden.name).toBe('Kitchen garden');
    expect(garden.climateProfile.source).toBe('user');
    expect(garden.structures.length).toBeGreaterThan(0);
    expect(garden.plantings.length).toBeGreaterThan(0);
    expect(garden.plantings[0]).toMatchObject({
      status: 'planned',
    });
  });
});

function setupRequest(templateId: string): GardenSetupRequest {
  return {
    climateProfile: {
      ...detroitClimateProfile,
      source: 'user',
    },
    gardenName: 'Kitchen garden',
    location: detroitLocation,
    plotDepthFt: 8,
    plotType: 'raisedBed',
    plotWidthFt: 12,
    templateId,
  };
}
