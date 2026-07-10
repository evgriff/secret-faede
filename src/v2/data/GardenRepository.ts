import type {
  CommitOutcome,
  DraftPlanRecord,
  GardenIssue,
  GardenPlan,
  GardenTask,
  GardenWorkspaceView,
  HarvestRecord,
  JournalEntry,
  PlanRevision,
  PublishedPlanRecord,
  WaterApplication,
  WateringRecommendation,
} from '../domain';

export interface WorkspaceSubscription {
  unsubscribe(): void;
}

export interface GardenRepository {
  discardDraft(userId: string): Promise<void>;
  getWorkspace(userId: string): Promise<GardenWorkspaceView>;
  listRevisions(limit?: number): Promise<PlanRevision[]>;
  publishDraft(input: {
    changeSummary: string;
    expectedRevisionId: string;
    userId: string;
  }): Promise<CommitOutcome>;
  publishSharedSettings(input: {
    expectedRevisionId: string;
    plan: GardenPlan;
    userId: string;
  }): Promise<CommitOutcome>;
  recordHarvest(record: HarvestRecord): Promise<CommitOutcome>;
  recordJournalEntry(entry: GardenIssue | JournalEntry): Promise<CommitOutcome>;
  recordWaterApplication(application: WaterApplication): Promise<CommitOutcome>;
  revertPublished(input: {
    expectedRevisionId: string;
    revisionId: string;
    userId: string;
  }): Promise<CommitOutcome>;
  saveDraft(input: {
    expectedRevisionId: string;
    plan: GardenPlan;
    userId: string;
  }): Promise<CommitOutcome>;
  subscribe(
    userId: string,
    onChange: (workspace: GardenWorkspaceView) => void,
    onError: (error: Error) => void,
  ): WorkspaceSubscription;
  updateTask(task: GardenTask): Promise<CommitOutcome>;
}

export interface PersistedWorkspaceState {
  drafts: Record<string, DraftPlanRecord>;
  harvests: HarvestRecord[];
  journal: Array<GardenIssue | JournalEntry>;
  published: PublishedPlanRecord;
  revisions: PlanRevision[];
  tasks: GardenTask[];
  waterApplications: WaterApplication[];
  wateringRecommendations: WateringRecommendation[];
}
