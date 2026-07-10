import type {
  CommitOutcome,
  GardenIssue,
  GardenTask,
  GardenWorkspaceView,
  HarvestRecord,
  JournalEntry,
  PlanRevision,
  PublishedPlanRecord,
  WaterApplication,
} from '../domain';
import type {
  GardenRepository,
  PersistedWorkspaceState,
  WorkspaceSubscription,
} from './GardenRepository';
import { createEmptyGardenPlan } from './defaultPlan';
import { normalizePersistedWorkspaceState } from './mockStateNormalization';
import {
  assertValidHarvestRecord,
  assertValidJournalRecord,
  assertValidTaskRecord,
  assertValidWaterApplicationRecord,
} from './operationRecordValidation';
import { assertValidGardenPlan } from './planValidation';
import { applySharedPlanSettings } from './sharedSettings';

export interface KeyValueStorage {
  getItem(key: string): string | null;
  removeItem(key: string): void;
  setItem(key: string, value: string): void;
}

export interface MockGardenRepositoryOptions {
  isOnline?: () => boolean;
  now?: () => Date;
  storage: KeyValueStorage;
  storageKey?: string;
}

const defaultStorageKey = 'secret-faeries:v2:workspace';

export class MockGardenRepository implements GardenRepository {
  private readonly now: () => Date;
  private readonly storage: KeyValueStorage;
  private readonly storageKey: string;
  private readonly subscribers = new Set<{
    onChange: (workspace: GardenWorkspaceView) => void;
    onError: (error: Error) => void;
    userId: string;
  }>();

  constructor(options: MockGardenRepositoryOptions) {
    this.now = options.now ?? (() => new Date());
    this.storage = options.storage;
    this.storageKey = options.storageKey ?? defaultStorageKey;
  }

  async getWorkspace(userId: string) {
    return toWorkspaceView(this.readState(), userId);
  }

  async saveDraft(input: Parameters<GardenRepository['saveDraft']>[0]) {
    assertValidGardenPlan(input.plan);
    const state = this.readState();
    if (state.published.revisionId !== input.expectedRevisionId) {
      return conflict(input.expectedRevisionId, state.published.revisionId);
    }
    const nowIso = this.now().toISOString();
    state.drafts[input.userId] = {
      baseRevisionId: input.expectedRevisionId,
      plan: structuredClone(input.plan),
      updatedAtIso: nowIso,
      userId: input.userId,
    };
    this.writeState(state);
    return this.success(nowIso);
  }

  async publishDraft(input: Parameters<GardenRepository['publishDraft']>[0]) {
    const state = this.readState();
    if (state.published.revisionId !== input.expectedRevisionId) {
      return conflict(input.expectedRevisionId, state.published.revisionId);
    }
    const draft = state.drafts[input.userId];
    if (!draft || draft.baseRevisionId !== input.expectedRevisionId) {
      return conflict(
        draft?.baseRevisionId ?? input.expectedRevisionId,
        state.published.revisionId,
      );
    }
    assertValidGardenPlan(draft.plan);
    const nowIso = this.now().toISOString();
    const revisionId = createRevisionId(nowIso);
    const published: PublishedPlanRecord = {
      plan: structuredClone({ ...draft.plan, updatedAtIso: nowIso }),
      publishedAtIso: nowIso,
      publishedByUserId: input.userId,
      revisionId,
    };
    const revision: PlanRevision = {
      ...structuredClone(published),
      changeSummary: input.changeSummary.trim() || 'Published garden plan',
    };
    state.published = published;
    state.revisions = [revision, ...state.revisions].slice(0, 100);
    delete state.drafts[input.userId];
    this.writeState(state);
    return this.success(nowIso);
  }

  async publishSharedSettings(
    input: Parameters<GardenRepository['publishSharedSettings']>[0],
  ) {
    assertValidGardenPlan(input.plan);
    const state = this.readState();
    if (state.published.revisionId !== input.expectedRevisionId) {
      return conflict(input.expectedRevisionId, state.published.revisionId);
    }
    const draft = state.drafts[input.userId];
    if (draft && draft.baseRevisionId !== input.expectedRevisionId) {
      return conflict(draft.baseRevisionId, state.published.revisionId);
    }
    const nowIso = this.now().toISOString();
    const revisionId = createRevisionId(nowIso);
    const published: PublishedPlanRecord = {
      plan: applySharedPlanSettings(state.published.plan, input.plan, nowIso),
      publishedAtIso: nowIso,
      publishedByUserId: input.userId,
      revisionId,
    };
    state.published = published;
    state.revisions = [
      {
        ...structuredClone(published),
        changeSummary: 'Updated shared garden settings',
      },
      ...state.revisions,
    ].slice(0, 100);
    if (draft) {
      state.drafts[input.userId] = {
        ...draft,
        baseRevisionId: revisionId,
        plan: applySharedPlanSettings(draft.plan, input.plan, nowIso),
        updatedAtIso: nowIso,
      };
    }
    this.writeState(state);
    return this.success(nowIso);
  }

  async discardDraft(userId: string) {
    const state = this.readState();
    delete state.drafts[userId];
    this.writeState(state);
  }

  async revertPublished(
    input: Parameters<GardenRepository['revertPublished']>[0],
  ) {
    const state = this.readState();
    if (state.published.revisionId !== input.expectedRevisionId) {
      return conflict(input.expectedRevisionId, state.published.revisionId);
    }
    const selected = state.revisions.find(
      (revision) => revision.revisionId === input.revisionId,
    );
    if (!selected) throw new Error('The selected revision no longer exists.');
    const nowIso = this.now().toISOString();
    const revisionId = createRevisionId(nowIso);
    const published: PublishedPlanRecord = {
      plan: structuredClone({ ...selected.plan, updatedAtIso: nowIso }),
      publishedAtIso: nowIso,
      publishedByUserId: input.userId,
      revisionId,
    };
    state.published = published;
    state.revisions = [
      {
        ...structuredClone(published),
        changeSummary: `Restored ${input.revisionId}`,
      },
      ...state.revisions,
    ].slice(0, 100);
    delete state.drafts[input.userId];
    this.writeState(state);
    return this.success(nowIso);
  }

  async listRevisions(limit = 20) {
    return structuredClone(
      this.readState().revisions.slice(0, Math.max(limit, 0)),
    );
  }

  async recordJournalEntry(entry: GardenIssue | JournalEntry) {
    assertValidJournalRecord(entry, entry.id);
    const state = this.readState();
    state.journal = upsertById(state.journal, entry);
    this.writeState(state);
    return this.success(this.now().toISOString());
  }

  async recordHarvest(record: HarvestRecord) {
    assertValidHarvestRecord(record, record.id);
    const state = this.readState();
    state.harvests = upsertById(state.harvests, record);
    this.writeState(state);
    return this.success(this.now().toISOString());
  }

  async recordWaterApplication(application: WaterApplication) {
    assertValidWaterApplicationRecord(application, application.id);
    const state = this.readState();
    const existing = state.waterApplications.find(
      (candidate) => candidate.id === application.id,
    );
    if (!existing && application.revision !== 1) {
      throw new Error('A new watering record must begin at revision 1.');
    }
    if (
      existing &&
      (application.revision !== existing.revision + 1 ||
        application.cropGroupId !== existing.cropGroupId ||
        application.recordedByUserId !== existing.recordedByUserId)
    ) {
      throw new Error(
        'A watering correction must increment one revision and preserve its crop group and recorder.',
      );
    }
    state.waterApplications = upsertById(state.waterApplications, application);
    this.writeState(state);
    return this.success(this.now().toISOString());
  }

  async updateTask(task: GardenTask) {
    assertValidTaskRecord(task, task.id);
    const state = this.readState();
    state.tasks = upsertById(state.tasks, task);
    this.writeState(state);
    return this.success(this.now().toISOString());
  }

  subscribe(
    userId: string,
    onChange: (workspace: GardenWorkspaceView) => void,
    onError: (error: Error) => void,
  ): WorkspaceSubscription {
    const subscriber = { onChange, onError, userId };
    this.subscribers.add(subscriber);
    queueMicrotask(() => {
      try {
        onChange(toWorkspaceView(this.readState(), userId));
      } catch (error) {
        onError(toError(error));
      }
    });
    return {
      unsubscribe: () => this.subscribers.delete(subscriber),
    };
  }

  private readState(): PersistedWorkspaceState {
    const raw = this.storage.getItem(this.storageKey);
    if (!raw) {
      const initial = createInitialState(this.now());
      this.storage.setItem(this.storageKey, JSON.stringify(initial));
      return initial;
    }
    try {
      const parsed: unknown = JSON.parse(raw);
      const state = normalizePersistedWorkspaceState(parsed);
      this.storage.setItem(this.storageKey, JSON.stringify(state));
      return state;
    } catch (error) {
      throw new Error(
        'The saved mock garden is corrupt. Its original data was preserved.',
        { cause: error },
      );
    }
  }

  private writeState(state: PersistedWorkspaceState) {
    this.storage.setItem(this.storageKey, JSON.stringify(state));
    for (const subscriber of this.subscribers) {
      try {
        subscriber.onChange(toWorkspaceView(state, subscriber.userId));
      } catch (error) {
        subscriber.onError(toError(error));
      }
    }
  }

  private success(nowIso: string): CommitOutcome {
    return { committedAtIso: nowIso, status: 'committed' };
  }
}

function createInitialState(now: Date): PersistedWorkspaceState {
  const nowIso = now.toISOString();
  const plan = createEmptyGardenPlan(now);
  const published: PublishedPlanRecord = {
    plan,
    publishedAtIso: nowIso,
    publishedByUserId: 'system',
    revisionId: 'revision-initial',
  };
  return {
    drafts: {},
    harvests: [],
    journal: [],
    published,
    revisions: [
      {
        ...structuredClone(published),
        changeSummary: 'Initial garden',
      },
    ],
    tasks: [],
    waterApplications: [],
    wateringRecommendations: [],
  };
}

function toWorkspaceView(
  state: PersistedWorkspaceState,
  userId: string,
): GardenWorkspaceView {
  return structuredClone({
    draft: state.drafts[userId] ?? null,
    operations: {
      harvests: state.harvests,
      journal: state.journal,
      tasks: state.tasks,
      waterApplications: state.waterApplications,
      wateringRecommendations: state.wateringRecommendations,
    },
    published: state.published,
    recentRevisions: state.revisions.slice(0, 20),
  });
}

function conflict(
  expectedRevisionId: string,
  actualRevisionId: string,
): CommitOutcome {
  return { actualRevisionId, expectedRevisionId, status: 'conflict' };
}

function upsertById<T extends { id: string }>(items: T[], item: T) {
  return [
    structuredClone(item),
    ...items.filter((candidate) => candidate.id !== item.id),
  ];
}

function createRevisionId(nowIso: string) {
  const suffix =
    globalThis.crypto?.randomUUID?.().slice(0, 12) ??
    Math.random().toString(36).slice(2, 14);
  return `revision-${nowIso.replace(/\D/g, '').slice(0, 17)}-${suffix}`;
}

function toError(error: unknown) {
  return error instanceof Error ? error : new Error(String(error));
}
