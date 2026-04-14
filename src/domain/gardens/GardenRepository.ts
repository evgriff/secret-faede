import type { GardenSummary } from './types';

export interface GardenRepository {
  getById(gardenId: string, uid: string): Promise<GardenSummary | null>;
  listForUser(uid: string): Promise<GardenSummary[]>;
}
