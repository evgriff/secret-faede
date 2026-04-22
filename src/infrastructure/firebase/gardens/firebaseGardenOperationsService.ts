import { httpsCallable } from 'firebase/functions';

import type {
  GardenOperationsRefreshResult,
  GardenOperationsService,
} from '../../../domain/gardens/GardenOperationsService';
import type { AppEnvironment } from '../../../shared/config/env';
import { getFirebaseFunctionsClient } from '../app';

export class FirebaseGardenOperationsService implements GardenOperationsService {
  private readonly refreshCallable: ReturnType<typeof httpsCallable>;

  constructor(environment: AppEnvironment) {
    this.refreshCallable = httpsCallable(
      getFirebaseFunctionsClient(environment),
      'refreshGardenOperations',
    );
  }

  async refreshGardenOperations(
    userId: string,
  ): Promise<GardenOperationsRefreshResult> {
    const response = await this.refreshCallable({ userId });
    const data = response.data as Partial<GardenOperationsRefreshResult>;

    return {
      backendAvailable: true,
      generatedAtIso: data.generatedAtIso ?? null,
      ok: data.ok === true,
      providerId: data.providerId ?? null,
      recommendationCount: data.recommendationCount ?? 0,
      taskCount: data.taskCount ?? 0,
    };
  }
}
