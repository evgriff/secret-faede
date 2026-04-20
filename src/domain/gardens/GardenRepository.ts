export * from './models';
export * from './validation';

import type { Garden } from './models';

export interface GardenRepository {
  getGarden(userId: string): Promise<Garden | null>;
  saveGarden(garden: Garden): Promise<void>;
}
