import type { IsoDateString } from '../../v2/domain/plan';

export interface GardenOperationsRefreshResult {
  backendAvailable: boolean;
  generatedAtIso: IsoDateString | null;
  ok: boolean;
  providerId: string | null;
  recommendationCount: number;
  taskCount: number;
}

export interface GardenOperationsService {
  refreshGardenOperations(
    userId: string,
  ): Promise<GardenOperationsRefreshResult>;
}
