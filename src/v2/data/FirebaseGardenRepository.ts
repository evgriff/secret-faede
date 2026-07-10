import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  runTransaction,
  setDoc,
  type DocumentData,
  type Firestore,
} from 'firebase/firestore';

import {
  WORKSPACE_SCHEMA_VERSION,
  type CommitOutcome,
  type DraftPlanRecord,
  type GardenIssue,
  type GardenTask,
  type GardenWorkspaceView,
  type HarvestRecord,
  type JournalEntry,
  type WaterApplication,
  type WateringRecommendation,
  type WorkspaceMetadata,
} from '../domain';
import type {
  GardenRepository,
  WorkspaceSubscription,
} from './GardenRepository';
import { subscribeFirebaseWorkspace } from './firebaseWorkspaceSubscription';
import {
  assertValidHarvestRecord,
  assertValidJournalRecord,
  assertValidTaskRecord,
  assertValidWaterApplicationRecord,
} from './operationRecordValidation';
import { assertValidGardenPlan } from './planValidation';
import {
  assertValidDraftRecord,
  assertValidPlanRevision,
  assertValidPublishedRecord,
} from './workspaceRecordValidation';
import { currentWateringRecommendations } from './wateringRecommendationValidation';
import { assertValidWateringRecommendationRecord } from './wateringRecommendationRecordValidation';
import type { WorkspaceMutationGateway } from './WorkspaceMutationGateway';

export class WorkspaceMigrationRequiredError extends Error {
  constructor() {
    super(
      'This garden workspace must be migrated to the v2 persistence model.',
    );
    this.name = 'WorkspaceMigrationRequiredError';
  }
}

export class UnsupportedWorkspaceVersionError extends Error {
  constructor(readonly schemaVersion: number) {
    super(`Workspace schema ${schemaVersion} is newer than this app supports.`);
    this.name = 'UnsupportedWorkspaceVersionError';
  }
}

export interface FirebaseGardenRepositoryOptions {
  db: Firestore;
  isOnline?: () => boolean;
  mutations: WorkspaceMutationGateway;
  now?: () => Date;
}

export class FirebaseGardenRepository implements GardenRepository {
  private readonly db: Firestore;
  private readonly mutations: WorkspaceMutationGateway;
  private readonly now: () => Date;

  constructor(options: FirebaseGardenRepositoryOptions) {
    this.db = options.db;
    this.mutations = options.mutations;
    this.now = options.now ?? (() => new Date());
  }

  async getWorkspace(userId: string): Promise<GardenWorkspaceView> {
    const [
      core,
      revisions,
      journal,
      harvests,
      tasks,
      waterApplications,
      wateringRecommendations,
    ] = await Promise.all([
      runTransaction(this.db, async (transaction) => {
        const metadataSnapshot = await transaction.get(this.metadataRef());
        const publishedSnapshot = await transaction.get(this.publishedRef());
        const draftSnapshot = await transaction.get(this.draftRef(userId));
        return { draftSnapshot, metadataSnapshot, publishedSnapshot };
      }),
      this.readCollection('revisions', 'publishedAtIso', 20, decodeRevision),
      this.readCollection<GardenIssue | JournalEntry>(
        'journal',
        'createdAtIso',
        250,
        decodeJournal,
      ),
      this.readCollection('harvests', 'occurredOn', 250, decodeHarvest),
      this.readCollection('tasks', 'dueOn', 300, decodeTask),
      this.readCollection<WaterApplication>(
        'waterApplications',
        'appliedAtIso',
        500,
        decodeWaterApplication,
      ),
      this.readCollection<WateringRecommendation>(
        'wateringRecommendations',
        'calculatedAtIso',
        300,
        decodeWateringRecommendation,
      ),
    ]);
    const { draftSnapshot, metadataSnapshot, publishedSnapshot } = core;

    const metadata = this.assertMetadata(
      metadataSnapshot.exists() ? metadataSnapshot.data() : null,
    );
    if (!publishedSnapshot.exists())
      throw new WorkspaceMigrationRequiredError();
    const published: unknown = publishedSnapshot.data();
    assertValidPublishedRecord(published, metadata.publishedRevisionId);
    let draft: DraftPlanRecord | null = null;
    if (draftSnapshot.exists()) {
      const candidate: unknown = draftSnapshot.data();
      assertValidDraftRecord(candidate, userId);
      draft = candidate;
    }

    return {
      draft,
      operations: {
        harvests,
        journal,
        tasks,
        waterApplications,
        wateringRecommendations: currentWateringRecommendations(
          wateringRecommendations,
          published.revisionId,
        ),
      },
      published,
      recentRevisions: revisions,
    };
  }

  async saveDraft(input: Parameters<GardenRepository['saveDraft']>[0]) {
    assertValidGardenPlan(input.plan);
    const nowIso = this.now().toISOString();
    const outcome = await runTransaction(this.db, async (transaction) => {
      const metadataSnapshot = await transaction.get(this.metadataRef());
      const metadata = this.assertMetadata(
        metadataSnapshot.exists() ? metadataSnapshot.data() : null,
      );
      if (metadata.publishedRevisionId !== input.expectedRevisionId) {
        return conflict(input.expectedRevisionId, metadata.publishedRevisionId);
      }
      transaction.set(this.draftRef(input.userId), {
        baseRevisionId: input.expectedRevisionId,
        plan: input.plan,
        updatedAtIso: nowIso,
        userId: input.userId,
      } satisfies DraftPlanRecord);
      return null;
    });
    return outcome ?? this.success(nowIso);
  }

  async publishDraft(input: Parameters<GardenRepository['publishDraft']>[0]) {
    return this.mutations.publishDraft(input);
  }

  async publishSharedSettings(
    input: Parameters<GardenRepository['publishSharedSettings']>[0],
  ) {
    return this.mutations.publishSharedSettings(input);
  }

  async discardDraft(userId: string) {
    await deleteDoc(this.draftRef(userId));
  }

  async revertPublished(
    input: Parameters<GardenRepository['revertPublished']>[0],
  ) {
    return this.mutations.revertPublished(input);
  }

  async listRevisions(maximum = 20) {
    const revisions = await this.readCollection(
      'revisions',
      'publishedAtIso',
      Math.min(Math.max(maximum, 1), 100),
      decodeRevision,
    );
    return revisions;
  }

  recordJournalEntry(entry: GardenIssue | JournalEntry) {
    assertValidJournalRecord(entry, entry.id);
    return this.writeOperation('journal', entry.id, entry);
  }

  recordHarvest(record: HarvestRecord) {
    assertValidHarvestRecord(record, record.id);
    return this.writeOperation('harvests', record.id, record);
  }

  recordWaterApplication(application: WaterApplication) {
    assertValidWaterApplicationRecord(application, application.id);
    return this.writeOperation(
      'waterApplications',
      application.id,
      application,
    );
  }

  updateTask(task: GardenTask) {
    assertValidTaskRecord(task, task.id);
    return this.writeOperation('tasks', task.id, task);
  }

  subscribe(
    userId: string,
    onChange: (workspace: GardenWorkspaceView) => void,
    onError: (error: Error) => void,
  ): WorkspaceSubscription {
    return subscribeFirebaseWorkspace(this.db, userId, onChange, onError);
  }

  private metadataRef() {
    return doc(this.db, 'gardenWorkspaces', 'main');
  }

  private publishedRef() {
    return doc(this.db, 'gardenWorkspaces', 'main', 'plans', 'published');
  }

  private draftRef(userId: string) {
    return doc(this.db, 'gardenWorkspaces', 'main', 'drafts', userId);
  }

  private collectionRef(name: string) {
    return collection(this.db, 'gardenWorkspaces', 'main', name);
  }

  private async readCollection<T>(
    name: string,
    orderField: string,
    maximum: number,
    decode: (value: unknown, documentId: string) => T,
  ) {
    const snapshot = await getDocs(
      query(
        this.collectionRef(name),
        orderBy(orderField, 'desc'),
        limit(maximum),
      ),
    );
    return snapshot.docs.map((entry) => decode(entry.data(), entry.id));
  }

  private async writeOperation(name: string, id: string, value: unknown) {
    const nowIso = this.now().toISOString();
    await setDoc(doc(this.db, 'gardenWorkspaces', 'main', name, id), value);
    return { committedAtIso: nowIso, status: 'committed' } as const;
  }

  private assertMetadata(value: DocumentData | null): WorkspaceMetadata {
    if (!value) throw new WorkspaceMigrationRequiredError();
    const schemaVersion: unknown = value.schemaVersion;
    if (typeof schemaVersion !== 'number') {
      throw new WorkspaceMigrationRequiredError();
    }
    if (schemaVersion > WORKSPACE_SCHEMA_VERSION) {
      throw new UnsupportedWorkspaceVersionError(schemaVersion);
    }
    if (schemaVersion !== WORKSPACE_SCHEMA_VERSION) {
      throw new WorkspaceMigrationRequiredError();
    }
    if (
      value.id !== 'main' ||
      typeof value.publishedRevisionId !== 'string' ||
      !value.publishedRevisionId.trim() ||
      typeof value.updatedAtIso !== 'string' ||
      !Number.isFinite(Date.parse(value.updatedAtIso))
    ) {
      throw new WorkspaceMigrationRequiredError();
    }
    return value as WorkspaceMetadata;
  }

  private success(nowIso: string): CommitOutcome {
    return { committedAtIso: nowIso, status: 'committed' };
  }
}

function conflict(
  expectedRevisionId: string,
  actualRevisionId: string,
): CommitOutcome {
  return { actualRevisionId, expectedRevisionId, status: 'conflict' };
}

function decodeRevision(value: unknown) {
  assertValidPlanRevision(value);
  return value;
}

function decodeJournal(value: unknown, documentId: string) {
  assertValidJournalRecord(value, documentId);
  return value;
}

function decodeHarvest(value: unknown, documentId: string) {
  assertValidHarvestRecord(value, documentId);
  return value;
}

function decodeTask(value: unknown, documentId: string) {
  assertValidTaskRecord(value, documentId);
  return value;
}

function decodeWaterApplication(value: unknown, documentId: string) {
  assertValidWaterApplicationRecord(value, documentId);
  return value;
}

function decodeWateringRecommendation(value: unknown, documentId: string) {
  assertValidWateringRecommendationRecord(value, documentId);
  return value;
}
