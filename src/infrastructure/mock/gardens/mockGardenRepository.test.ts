import {
  createDefaultGarden,
  createDefaultPlanting,
} from '../../../domain/gardens/GardenRepository';
import { MockGardenRepository } from './mockGardenRepository';

describe('MockGardenRepository', () => {
  it('persists one garden per user in local storage', async () => {
    const repository = new MockGardenRepository();
    const garden = {
      ...createDefaultGarden('user-a'),
      plantings: [
        createDefaultPlanting({
          id: 'planting-1',
          label: 'Tomato',
          xFt: 3.5,
          yFt: 2,
        }),
      ],
    };

    await repository.saveGarden(garden);

    expect(await repository.getGarden('user-a')).toEqual(garden);
    expect(await repository.getGarden('user-b')).toBeNull();
  });
});
