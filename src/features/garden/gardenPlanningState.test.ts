import {
  createDefaultGarden,
  createDefaultPlanting,
} from '../../domain/gardens/GardenRepository';
import { buildPlantGroups } from './gardenPlanningState';
import {
  migrateGardenPlanningStateRecord,
  readGardenPlanningState,
  writeGardenPlanningState,
} from './gardenPlanningStorage';

describe('garden planning state', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('derives plant groups from the saved garden aggregate', () => {
    const garden = makeGarden();

    expect(buildPlantGroups(garden)).toMatchObject([
      {
        id: 'tomato-row',
        placementMode: 'row',
        quantity: 3,
        support: {
          perPlant: true,
          quantity: 3,
          type: 'cage',
        },
      },
    ]);
  });

  it('migrates legacy browser planning state explicitly', () => {
    const garden = makeGarden();
    const migration = migrateGardenPlanningStateRecord(
      {
        activeEditorPlantId: 'missing-plant',
        detailedViewOpen: true,
        editorOpen: true,
        markerLayer: [{ id: 'marker-1' }],
        plantNodes: [{ id: 'node-1' }],
        selectedPlantId: 'tomato-row',
        wrenchPlantId: 'tomato-row',
      },
      garden,
    );

    expect(migration.migrations).toEqual([
      'dropped legacy markerLayer',
      'dropped legacy plantNodes',
      'migrated plan workspace state to v2',
    ]);
    expect(migration.state).toMatchObject({
      detailedView: {
        isOpen: true,
        subject: {
          groupId: 'tomato-row',
          type: 'plantGroup',
        },
      },
      editor: {
        groupId: 'tomato-row',
        isOpen: true,
        source: 'detailedView',
      },
      selectedPlantGroupId: 'tomato-row',
    });
  });

  it('persists only lightweight browser-local planning state', () => {
    const garden = makeGarden();
    const initial = readGardenPlanningState('user-a', garden).state;

    writeGardenPlanningState('user-a', {
      ...initial,
      hoveredPlantGroupId: 'tomato-row',
      labelVisibility: {
        groupIds: ['tomato-row'],
        mode: 'visible',
      },
      selectedPlantGroupId: 'tomato-row',
    });

    const hydrated = readGardenPlanningState('user-a', garden);

    expect(hydrated.migrations).toEqual([]);
    expect(hydrated.state).toMatchObject({
      hoveredPlantGroupId: null,
      labelVisibility: {
        groupIds: ['tomato-row'],
        mode: 'visible',
      },
      plantGroups: [
        {
          id: 'tomato-row',
        },
      ],
      selectedPlantGroupId: 'tomato-row',
    });
  });
});

function makeGarden() {
  return {
    ...createDefaultGarden('user-a'),
    plantings: [
      {
        ...createDefaultPlanting({
          id: 'tomato-row',
          label: 'Tomato',
          xFt: 5,
          yFt: 4,
        }),
        cropId: 'tomato',
        instances: [],
        mode: 'row' as const,
        plantCount: 3,
        rowLengthFt: 4,
        spacingInches: 24,
      },
    ],
  };
}
