import {
  createDefaultGarden,
  createDefaultPlanting,
  createDefaultStructure,
} from '../../domain/gardens/GardenRepository';
import { findPlanWarnings } from './gardenPlanning';
import {
  getPathLengthDimension,
  getPathNarrowDimension,
  getWalkablePathWidthFt,
  resizePathLength,
  resizePathWalkableWidth,
} from './gardenStructureRules';

describe('garden access rules', () => {
  it('treats blocked primary paths as real access issues', () => {
    const garden = {
      ...createDefaultGarden('user-a'),
      plantings: [
        {
          ...createDefaultPlanting({
            id: 'lettuce-1',
            label: 'Lettuce',
            xFt: 5,
            yFt: 4,
          }),
          spacingInches: 24,
        },
      ],
      structures: [
        {
          ...createDefaultStructure({
            id: 'path-main',
            type: 'pathway',
            xFt: 4,
            yFt: 0,
          }),
          continuousPath: true,
          label: 'Main path',
        },
      ],
    };

    const warnings = findPlanWarnings(garden);

    expect(warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'pathway-lettuce-1-path-main',
          severity: 'critical',
          title: 'Primary path blocked',
        }),
      ]),
    );
  });

  it('keeps access path width tied to the narrow side of the footprint', () => {
    const verticalPath = {
      ...createDefaultStructure({
        id: 'path-vertical',
        type: 'pathway',
        xFt: 1,
        yFt: 1,
      }),
      depthFt: 10,
      widthFt: 2.5,
    };
    const horizontalPath = {
      ...createDefaultStructure({
        id: 'path-horizontal',
        type: 'pathway',
        xFt: 1,
        yFt: 1,
      }),
      depthFt: 2,
      widthFt: 8,
    };

    expect(getWalkablePathWidthFt(verticalPath)).toBe(2.5);
    expect(getPathNarrowDimension(verticalPath)).toBe('widthFt');
    expect(getPathLengthDimension(verticalPath)).toBe('depthFt');
    expect(resizePathWalkableWidth(verticalPath, 3)).toMatchObject({
      depthFt: 10,
      widthFt: 3,
    });
    expect(resizePathLength(verticalPath, 12)).toMatchObject({
      depthFt: 12,
      widthFt: 2.5,
    });

    expect(getWalkablePathWidthFt(horizontalPath)).toBe(2);
    expect(getPathNarrowDimension(horizontalPath)).toBe('depthFt');
    expect(getPathLengthDimension(horizontalPath)).toBe('widthFt');
    expect(resizePathWalkableWidth(horizontalPath, 4)).toMatchObject({
      depthFt: 4,
      widthFt: 8,
    });
    expect(resizePathLength(horizontalPath, 9)).toMatchObject({
      depthFt: 2,
      widthFt: 9,
    });
  });
});
