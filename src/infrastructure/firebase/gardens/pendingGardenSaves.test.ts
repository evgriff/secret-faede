import {
  createDefaultGarden,
  createDefaultPlanting,
  CURRENT_GARDEN_SCHEMA_VERSION,
} from '../../../domain/gardens/GardenRepository';
import {
  clearPendingGardenSave,
  getPendingGardenSaveUserIds,
  markPendingGardenSaveConflict,
  queuePendingGardenSave,
  readPendingGardenSave,
  readPendingGardenSaveMetadata,
} from './pendingGardenSaves';

describe('pendingGardenSaves', () => {
  it('queues and reads the latest garden save by user', () => {
    const garden = {
      ...createDefaultGarden('user-a'),
      plantings: [
        createDefaultPlanting({
          id: 'planting-1',
          label: 'Offline tomato',
          xFt: 2,
          yFt: 3,
        }),
      ],
    };

    queuePendingGardenSave(garden, {
      draftBaseRevisionId: 'revision-a',
      draftUpdatedAtIso: '2026-04-21T12:00:00.000Z',
    });

    expect(getPendingGardenSaveUserIds()).toEqual(['user-a']);
    expect(readPendingGardenSave('user-a')).toMatchObject({
      plantings: garden.plantings,
      schemaVersion: CURRENT_GARDEN_SCHEMA_VERSION,
    });
    expect(readPendingGardenSaveMetadata('user-a')).toMatchObject({
      conflictDetectedAtIso: null,
      draftBaseRevisionId: 'revision-a',
      draftUpdatedAtIso: '2026-04-21T12:00:00.000Z',
      publishedRevisionId: null,
      schemaVersion: CURRENT_GARDEN_SCHEMA_VERSION,
      userId: 'user-a',
    });

    markPendingGardenSaveConflict('user-a', 'revision-b');

    expect(readPendingGardenSaveMetadata('user-a')).toMatchObject({
      draftBaseRevisionId: 'revision-a',
      publishedRevisionId: 'revision-b',
      userId: 'user-a',
    });
    expect(
      readPendingGardenSaveMetadata('user-a')?.conflictDetectedAtIso,
    ).toEqual(expect.any(String));

    clearPendingGardenSave('user-a');

    expect(readPendingGardenSave('user-a')).toBeNull();
    expect(readPendingGardenSaveMetadata('user-a')).toBeNull();
  });
});
