import type {
  GardenOperationsRefreshResult,
  GardenOperationsService,
} from '../../../domain/gardens/GardenOperationsService';

export class MockGardenOperationsService implements GardenOperationsService {
  refreshGardenOperations(): Promise<GardenOperationsRefreshResult> {
    return Promise.resolve({
      backendAvailable: false,
      generatedAtIso: null,
      ok: false,
      providerId: null,
      recommendationCount: 0,
      taskCount: 0,
    });
  }
}
