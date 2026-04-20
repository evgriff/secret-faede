import type {
  Garden,
  GardenRepository,
} from '../../../domain/gardens/GardenRepository';
import { parseGarden } from '../../../domain/gardens/GardenRepository';
import {
  readJsonStorageValue,
  writeJsonStorageValue,
} from '../../../shared/lib/storage';

export class MockGardenRepository implements GardenRepository {
  async getGarden(userId: string): Promise<Garden | null> {
    const storedGarden = readJsonStorageValue<unknown>(
      getGardenStorageKey(userId),
    );

    return storedGarden ? parseGarden(userId, storedGarden) : null;
  }

  async saveGarden(garden: Garden): Promise<void> {
    writeJsonStorageValue(getGardenStorageKey(garden.userId), garden);
  }
}

function getGardenStorageKey(userId: string) {
  return `secret-faede.garden.v1:${encodeURIComponent(userId)}`;
}
