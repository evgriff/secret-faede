import type { GardenOperationsSnapshot } from './operations';
import type { GardenPlan, IsoDateString } from './plan';

export const WORKSPACE_SCHEMA_VERSION = 2 as const;

export interface WorkspaceMetadata {
  id: 'main';
  publishedRevisionId: string;
  schemaVersion: typeof WORKSPACE_SCHEMA_VERSION;
  updatedAtIso: IsoDateString;
}

export interface PublishedPlanRecord {
  plan: GardenPlan;
  publishedAtIso: IsoDateString;
  publishedByUserId: string;
  revisionId: string;
}

export interface DraftPlanRecord {
  baseRevisionId: string;
  plan: GardenPlan;
  updatedAtIso: IsoDateString;
  userId: string;
}

export interface PlanRevision extends PublishedPlanRecord {
  changeSummary: string;
}

export interface GardenWorkspaceView {
  draft: DraftPlanRecord | null;
  operations: GardenOperationsSnapshot;
  published: PublishedPlanRecord;
  recentRevisions: PlanRevision[];
}

export type CommitOutcome =
  | { committedAtIso: IsoDateString; status: 'committed' }
  | { queuedAtIso: IsoDateString; status: 'queued' }
  | {
      actualRevisionId: string;
      expectedRevisionId: string;
      status: 'conflict';
    };

export const workspacePaths = {
  alert: (id: string) => `gardenWorkspaces/main/alerts/${id}`,
  draft: (userId: string) => `gardenWorkspaces/main/drafts/${userId}`,
  harvest: (id: string) => `gardenWorkspaces/main/harvests/${id}`,
  journal: (id: string) => `gardenWorkspaces/main/journal/${id}`,
  metadata: 'gardenWorkspaces/main',
  notificationDelivery: (userId: string, id: string) =>
    `users/${userId}/notificationDeliveries/${id}`,
  publishedPlan: 'gardenWorkspaces/main/plans/published',
  revision: (id: string) => `gardenWorkspaces/main/revisions/${id}`,
  task: (id: string) => `gardenWorkspaces/main/tasks/${id}`,
  waterApplication: (id: string) =>
    `gardenWorkspaces/main/waterApplications/${id}`,
  waterBalance: (plantingGroupId: string) =>
    `gardenWorkspaces/main/waterBalances/${plantingGroupId}`,
  wateringRecommendation: (id: string) =>
    `gardenWorkspaces/main/wateringRecommendations/${id}`,
  weatherSnapshot: (id: string) =>
    `gardenWorkspaces/main/weatherSnapshots/${id}`,
} as const;
