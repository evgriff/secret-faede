import { httpsCallable, type HttpsCallable } from 'firebase/functions';

import { getFirebaseFunctionsClient } from '../../infrastructure/firebase/app';
import type { AppEnvironment } from '../../shared/config/env';
import type { CommitOutcome } from '../domain';
import type { GardenRepository } from './GardenRepository';
import type { WorkspaceMutationGateway } from './WorkspaceMutationGateway';

export type {
  WorkspaceMutationGateway,
  WorkspaceMutationGateway as FirebaseWorkspaceMutationGateway,
} from './WorkspaceMutationGateway';

export class CallableFirebaseWorkspaceMutationGateway implements WorkspaceMutationGateway {
  private readonly publishDraftCallable: HttpsCallable;
  private readonly publishSettingsCallable: HttpsCallable;
  private readonly revertCallable: HttpsCallable;

  constructor(environment: AppEnvironment) {
    const functions = getFirebaseFunctionsClient(environment);
    this.publishDraftCallable = httpsCallable(
      functions,
      'publishGardenDraftV2',
    );
    this.publishSettingsCallable = httpsCallable(
      functions,
      'publishGardenSettingsV2',
    );
    this.revertCallable = httpsCallable(functions, 'revertGardenPlanV2');
  }

  async publishDraft(input: Parameters<GardenRepository['publishDraft']>[0]) {
    const response = await this.publishDraftCallable({
      changeSummary: input.changeSummary,
      expectedRevisionId: input.expectedRevisionId,
    });
    return readCommitOutcome(response.data);
  }

  async publishSharedSettings(
    input: Parameters<GardenRepository['publishSharedSettings']>[0],
  ) {
    const response = await this.publishSettingsCallable({
      expectedRevisionId: input.expectedRevisionId,
      plan: input.plan,
    });
    return readCommitOutcome(response.data);
  }

  async revertPublished(
    input: Parameters<GardenRepository['revertPublished']>[0],
  ) {
    const response = await this.revertCallable({
      expectedRevisionId: input.expectedRevisionId,
      revisionId: input.revisionId,
    });
    return readCommitOutcome(response.data);
  }
}

export function readCommitOutcome(value: unknown): CommitOutcome {
  if (!value || typeof value !== 'object') {
    throw new Error('The garden mutation returned an invalid response.');
  }
  const result = value as Record<string, unknown>;
  if (
    result.status === 'committed' &&
    typeof result.committedAtIso === 'string' &&
    Number.isFinite(Date.parse(result.committedAtIso))
  ) {
    return { committedAtIso: result.committedAtIso, status: 'committed' };
  }
  if (
    result.status === 'conflict' &&
    typeof result.actualRevisionId === 'string' &&
    typeof result.expectedRevisionId === 'string'
  ) {
    return {
      actualRevisionId: result.actualRevisionId,
      expectedRevisionId: result.expectedRevisionId,
      status: 'conflict',
    };
  }
  throw new Error('The garden mutation returned an unsupported result.');
}
