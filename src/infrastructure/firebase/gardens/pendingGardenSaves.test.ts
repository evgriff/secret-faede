import {
  createDefaultGarden,
  createDefaultPlanting,
} from '../../../domain/gardens/GardenRepository';
import {
  clearPendingGardenSave,
  getPendingGardenSaveUserIds,
  queuePendingGardenSave,
  readPendingGardenSave,
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

    queuePendingGardenSave(garden);

    expect(getPendingGardenSaveUserIds()).toEqual(['user-a']);
    expect(readPendingGardenSave('user-a')).toEqual(garden);

    clearPendingGardenSave('user-a');

    expect(readPendingGardenSave('user-a')).toBeNull();
  });
});
