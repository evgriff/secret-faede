import type { GardenRepository } from '../../../domain/gardens/GardenRepository';
import type { GardenSummary } from '../../../domain/gardens/types';
import { mockGardens } from './mockGardens';

export class MockGardenRepository implements GardenRepository {
  async getById(gardenId: string): Promise<GardenSummary | null> {
    return mockGardens.find((garden) => garden.id === gardenId) ?? null;
  }

  async listForUser(): Promise<GardenSummary[]> {
    return [...mockGardens];
  }
}
