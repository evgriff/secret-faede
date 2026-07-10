import type { CommitOutcome } from '../domain';
import type { GardenRepository } from './GardenRepository';

export interface WorkspaceMutationGateway {
  publishDraft(
    input: Parameters<GardenRepository['publishDraft']>[0],
  ): Promise<CommitOutcome>;
  publishSharedSettings(
    input: Parameters<GardenRepository['publishSharedSettings']>[0],
  ): Promise<CommitOutcome>;
  revertPublished(
    input: Parameters<GardenRepository['revertPublished']>[0],
  ): Promise<CommitOutcome>;
}
