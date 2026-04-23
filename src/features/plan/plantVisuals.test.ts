import type {
  CropProfile,
  Planting,
} from '../../domain/gardens/GardenRepository';
import {
  getPlantGroupLabelDecision,
  getPlantGroupVisual,
} from './plantVisuals';

describe('plantVisuals', () => {
  it('maps common crop families to distinct group icons', () => {
    expect(getPlantGroupVisual(makeCrop('Roma tomato'), makePlant()).icon).toBe(
      'tomato',
    );
    expect(getPlantGroupVisual(makeCrop('Carrot'), makePlant()).icon).toBe(
      'root',
    );
    expect(getPlantGroupVisual(makeCrop('Snap pea'), makePlant()).icon).toBe(
      'vine',
    );
    expect(
      getPlantGroupVisual(makeCrop('Butterhead lettuce'), makePlant()).icon,
    ).toBe('leafy');
  });

  it('keeps hover labels quiet for tiny groups but allows click fallback labels', () => {
    const tinyFootprint = { depthFt: 0.75, widthFt: 0.75 };

    expect(
      getPlantGroupLabelDecision({
        dragging: false,
        footprint: tinyFootprint,
        hovering: true,
        label: 'Tiny basil, 1 plant',
        pinned: false,
      }),
    ).toMatchObject({
      placement: 'right',
      visible: false,
    });

    expect(
      getPlantGroupLabelDecision({
        dragging: false,
        footprint: tinyFootprint,
        hovering: false,
        label: 'Tiny basil, 1 plant',
        pinned: true,
      }),
    ).toMatchObject({
      placement: 'right',
      visible: true,
    });
  });

  it('places labels inside larger grouped footprints', () => {
    expect(
      getPlantGroupLabelDecision({
        dragging: false,
        footprint: { depthFt: 2.5, widthFt: 5.5 },
        hovering: true,
        label: 'Tomato, 4 plants',
        pinned: false,
      }),
    ).toMatchObject({
      hasInteriorRoom: true,
      placement: 'inside',
      visible: true,
    });
  });
});

function makeCrop(commonName: string): CropProfile {
  return {
    category: 'vegetable',
    commonName,
    defaultIcon: commonName.toLowerCase(),
    family: '',
    growthForm: 'upright',
    name: commonName,
    roles: [],
  } as unknown as CropProfile;
}

function makePlant(): Planting {
  return { label: 'Plant' } as Planting;
}
