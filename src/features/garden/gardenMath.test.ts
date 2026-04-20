import { defaultGardenPlot } from '../../domain/gardens/GardenRepository';
import {
  clientPointToPlotFeet,
  clampPlantToPlot,
  normalizePointToPlot,
  pixelsPerFoot,
  plotFeetToPixels,
} from './gardenMath';

describe('gardenMath', () => {
  it('converts between plot feet and pixels with a stable scale', () => {
    expect(pixelsPerFoot).toBe(32);
    expect(plotFeetToPixels({ xFt: 3.5, yFt: 2 })).toEqual({
      left: 3.5 * pixelsPerFoot,
      top: 2 * pixelsPerFoot,
    });
    expect(
      clientPointToPlotFeet(
        { clientX: 112, clientY: 80 },
        { left: 0, top: 0 },
        defaultGardenPlot,
      ),
    ).toEqual({ xFt: 3.5, yFt: 2.5 });
  });

  it('snaps and clamps plant positions in plot coordinates', () => {
    expect(
      normalizePointToPlot({ xFt: 3.26, yFt: 9.9 }, defaultGardenPlot, true),
    ).toEqual({ xFt: 3.5, yFt: 8 });
    expect(
      clampPlantToPlot(
        { id: 'plant-1', type: 'plant', xFt: -2, yFt: 20 },
        defaultGardenPlot,
      ),
    ).toEqual({ id: 'plant-1', type: 'plant', xFt: 0, yFt: 8 });
  });
});
