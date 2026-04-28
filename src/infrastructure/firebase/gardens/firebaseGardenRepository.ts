import {
  parseGarden,
  parseHarvestEvents,
  parseJournalEntries,
  parseNotificationLogs,
  parsePlantings,
  parsePlot,
  parseStructures,
  parseTasks,
  parseWateringSchedule,
  parseWeatherSnapshots,
  type Garden,
  type GardenRepository,
  type GardenWorkspaceListener,
  type GardenWorkspaceUnsubscribe,
  type SaveSharedGardenOperationsRequest,
} from '../../../domain/gardens/GardenRepository';
import {
  createDraftFromPublished,
  createGardenChangesetSummary,
  createInitialGardenRevision,
  hasGardenChanges,
  parseGardenDraft,
  parsePublishedGardenRevision,
  prepareGardenForUser,
  type GardenDraft,
  type GardenPublishRequest,
  type GardenPublishResult,
  type GardenRevertRequest,
  type GardenWorkspace,
  type PublishedGardenRevision,
} from '../../../domain/gardens/gardenWorkspace';
import {
  applyActorToNewSharedOperations,
  applySharedGardenOperationsPatch,
  createEmptySharedGardenOperations,
  getSharedGardenOperations,
  mergeSharedGardenOperations,
  overlaySharedGardenOperations,
  stripSharedGardenOperations,
  type SharedGardenOperations,
} from '../../../domain/gardens/sharedOperations';
import type { AppEnvironment } from '../../../shared/config/env';
import { isBrowserOffline } from '../../../shared/network/networkStatus';
import { getFirestoreClient } from '../app';
import {
  clearPendingGardenSave,
  getPendingGardenSaveUserIds,
  markPendingGardenSaveConflict,
  queuePendingGardenSave,
  readPendingGardenSave,
  readPendingGardenSaveMetadata,
} from './pendingGardenSaves';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  serverTimestamp,
  setDoc,
  writeBatch,
  type Firestore,
  type Unsubscribe,
} from 'firebase/firestore';

export class FirebaseGardenRepository implements GardenRepository {
  private readonly firestore: Firestore;

  constructor(environment: AppEnvironment) {
    this.firestore = getFirestoreClient(environment);

    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        void this.flushPendingSaves().catch(() => undefined);
      });
      void this.flushPendingSaves().catch(() => undefined);
    }
  }

  async getGarden(userId: string): Promise<Garden | null> {
    const workspace = await this.getWorkspace(userId);

    return workspace.draft.garden;
  }

  async saveGarden(garden: Garden): Promise<void> {
    const workspace = await this.getWorkspace(garden.userId);

    await this.saveDraft({
      ...workspace.draft,
      garden,
      updatedAtIso: new Date().toISOString(),
    });
  }

  async getWorkspace(userId: string): Promise<GardenWorkspace> {
    if (!isBrowserOffline()) {
      await this.flushPendingSave(userId).catch(() => undefined);
    }

    const basePublished = await this.getPublishedRevision(userId);
    const sharedOperations = await this.getSharedOperations(
      userId,
      basePublished.garden,
    );
    const published = {
      ...basePublished,
      garden: overlaySharedGardenOperations(
        basePublished.garden,
        sharedOperations,
      ),
    };
    const draft = await this.getDraft(userId, published, sharedOperations);
    const revisions = await this.getRevisionHistory(userId, published);
    const draftSummary = createGardenChangesetSummary(
      prepareGardenForUser(published.garden, userId),
      draft.garden,
      draft.suggestionDecisions,
    );

    return {
      draft,
      draftChanged: hasGardenChanges(draftSummary),
      draftIsStale: draft.baseRevisionId !== published.id,
      hasDraft: await this.hasDraft(userId),
      published,
      revisions,
    };
  }

  async saveDraft(draft: GardenDraft): Promise<void> {
    const preparedDraft = {
      ...draft,
      garden: prepareDraftGardenForPersistence(draft.garden, draft.userId),
      updatedAtIso: draft.updatedAtIso || new Date().toISOString(),
    };

    if (isBrowserOffline()) {
      queuePendingGardenSave(preparedDraft.garden, {
        draftBaseRevisionId: preparedDraft.baseRevisionId,
        draftUpdatedAtIso: preparedDraft.updatedAtIso,
        kind: 'draft',
      });
      return;
    }

    try {
      await this.commitDraft(preparedDraft);
      if (
        readPendingGardenSaveMetadata(draft.userId)?.kind !== 'sharedOperations'
      ) {
        clearPendingGardenSave(draft.userId);
      }
    } catch (saveError) {
      if (shouldQueueSaveFailure(saveError)) {
        queuePendingGardenSave(preparedDraft.garden, {
          draftBaseRevisionId: preparedDraft.baseRevisionId,
          draftUpdatedAtIso: preparedDraft.updatedAtIso,
          kind: 'draft',
        });
        return;
      }

      throw saveError;
    }
  }

  async discardDraft(userId: string): Promise<GardenDraft> {
    const published = await this.getPublishedRevision(userId);
    const draft = createDraftFromPublished(published, userId);

    await this.commitDraft(draft);
    clearPendingGardenSave(userId);
    return draft;
  }

  async publishDraft(
    request: GardenPublishRequest,
  ): Promise<GardenPublishResult> {
    const workspace = await this.getWorkspace(request.userId);

    if (
      workspace.draft.baseRevisionId !== workspace.published.id &&
      !request.force
    ) {
      return {
        conflict: {
          currentRevisionId: workspace.published.id,
          draftBaseRevisionId: workspace.draft.baseRevisionId,
          message: 'The published garden changed after this draft was started.',
        },
        revision: null,
        status: 'conflict',
        workspace,
      };
    }

    const revision = this.createPublishedRevision({
      action: 'publish',
      baseGarden: prepareGardenForUser(
        workspace.published.garden,
        request.userId,
      ),
      baseRevisionId: workspace.draft.baseRevisionId,
      garden: stripSharedGardenOperations(workspace.draft.garden),
      publishedByEmail: request.userEmail,
      publishedByUserId: request.userId,
      revertedFromRevisionId: null,
      suggestionDecisions: workspace.draft.suggestionDecisions,
    });

    await this.commitPublishedRevision(revision);
    await this.commitDraft({
      ...createDraftFromPublished(revision, request.userId),
      updatedAtIso: revision.publishedAtIso,
    });
    clearPendingGardenSave(request.userId);

    return {
      conflict: null,
      revision,
      status: 'published',
      workspace: await this.getWorkspace(request.userId),
    };
  }

  async revertToRevision(
    request: GardenRevertRequest,
  ): Promise<GardenPublishResult> {
    const workspace = await this.getWorkspace(request.userId);
    const targetRevision = workspace.revisions.find(
      (revision) => revision.id === request.revisionId,
    );

    if (!targetRevision) {
      throw new Error('Published revision not found.');
    }

    const revision = this.createPublishedRevision({
      action: 'revert',
      baseGarden: prepareGardenForUser(
        workspace.published.garden,
        request.userId,
      ),
      baseRevisionId: workspace.published.id,
      garden: stripSharedGardenOperations(
        prepareGardenForUser(targetRevision.garden, request.userId),
      ),
      publishedByEmail: request.userEmail,
      publishedByUserId: request.userId,
      revertedFromRevisionId: targetRevision.id,
      suggestionDecisions: [],
    });

    await this.commitPublishedRevision(revision);
    await this.commitDraft({
      ...createDraftFromPublished(revision, request.userId),
      updatedAtIso: revision.publishedAtIso,
    });
    clearPendingGardenSave(request.userId);

    return {
      conflict: null,
      revision,
      status: 'published',
      workspace: await this.getWorkspace(request.userId),
    };
  }

  async saveSharedOperations({
    actor,
    baseGarden,
    updatedGarden,
    userId,
  }: SaveSharedGardenOperationsRequest): Promise<Garden> {
    if (shouldKeepDraftOperations(updatedGarden)) {
      await this.saveGarden(updatedGarden);
      return updatedGarden;
    }

    const authoredGarden = applyActorToNewSharedOperations({
      actor,
      baseGarden,
      updatedGarden: prepareGardenForUser(updatedGarden, userId),
    });
    const updatedOperations = getSharedGardenOperations(authoredGarden);

    if (isBrowserOffline()) {
      queuePendingGardenSave(authoredGarden, {
        kind: 'sharedOperations',
      });
      return authoredGarden;
    }

    try {
      const currentOperations = await this.getSharedOperations(userId);
      const nextOperations = applySharedGardenOperationsPatch({
        base: getSharedGardenOperations(baseGarden),
        current: currentOperations,
        updated: updatedOperations,
      });

      await this.commitSharedOperationsPatch({
        base: currentOperations,
        next: nextOperations,
      });
      if (readPendingGardenSaveMetadata(userId)?.kind === 'sharedOperations') {
        clearPendingGardenSave(userId);
      }

      return overlaySharedGardenOperations(authoredGarden, nextOperations);
    } catch (saveError) {
      if (shouldQueueSaveFailure(saveError)) {
        queuePendingGardenSave(authoredGarden, {
          kind: 'sharedOperations',
        });
        return authoredGarden;
      }

      throw saveError;
    }
  }

  subscribeWorkspace(
    userId: string,
    listener: GardenWorkspaceListener,
  ): GardenWorkspaceUnsubscribe {
    let active = true;
    let scheduled = false;
    const unsubscriptions: Unsubscribe[] = [];

    const emit = () => {
      scheduled = false;

      if (!active) {
        return;
      }

      void this.getWorkspace(userId)
        .then((workspace) => {
          if (active) {
            listener(workspace);
          }
        })
        .catch(() => undefined);
    };
    const scheduleEmit = () => {
      if (scheduled) {
        return;
      }

      scheduled = true;
      setTimeout(emit, 0);
    };

    unsubscriptions.push(
      onSnapshot(this.getWorkspaceDocument(), scheduleEmit, scheduleEmit),
      onSnapshot(this.getDraftDocument(userId), scheduleEmit, scheduleEmit),
      ...sharedOperationCollectionNames.map((collectionName) =>
        onSnapshot(
          this.getSharedOperationsCollection(collectionName),
          scheduleEmit,
          scheduleEmit,
        ),
      ),
    );
    scheduleEmit();

    return () => {
      active = false;

      for (const unsubscribe of unsubscriptions) {
        unsubscribe();
      }
    };
  }

  private async getPublishedRevision(
    userId: string,
  ): Promise<PublishedGardenRevision> {
    try {
      const snapshot = await getDoc(this.getWorkspaceDocument());
      const parsedRevision = parsePublishedGardenRevision(
        userId,
        snapshot.exists() ? snapshot.data() : null,
      );

      if (parsedRevision) {
        return parsedRevision;
      }
    } catch (loadError) {
      const pendingGarden = readPendingGardenSave(userId);

      if (pendingGarden) {
        return createInitialGardenRevision(userId);
      }

      throw loadError;
    }

    const legacyGarden = await this.getLegacyGarden(userId);
    const initialRevision = legacyGarden
      ? this.createPublishedRevision({
          action: 'initial',
          baseGarden: legacyGarden,
          baseRevisionId: null,
          garden: legacyGarden,
          publishedByEmail: 'legacy',
          publishedByUserId: userId,
          revertedFromRevisionId: null,
          suggestionDecisions: [],
        })
      : createInitialGardenRevision(userId);

    await this.commitPublishedRevision(initialRevision);
    return initialRevision;
  }

  private async getDraft(
    userId: string,
    published: PublishedGardenRevision,
    sharedOperations: SharedGardenOperations,
  ): Promise<GardenDraft> {
    const pendingGarden = readPendingGardenSave(userId);

    if (pendingGarden) {
      const metadata = readPendingGardenSaveMetadata(userId);

      return {
        ...createDraftFromPublished(published, userId),
        baseRevisionId: metadata?.draftBaseRevisionId ?? published.id,
        garden:
          metadata?.kind === 'sharedOperations'
            ? pendingGarden
            : overlaySharedGardenOperations(pendingGarden, sharedOperations),
        updatedAtIso:
          metadata?.draftUpdatedAtIso ??
          metadata?.queuedAtIso ??
          new Date().toISOString(),
      };
    }

    const snapshot = await getDoc(this.getDraftDocument(userId));
    const parsedDraft = parseGardenDraft(
      userId,
      snapshot.exists() ? snapshot.data() : null,
      published,
    );

    const draft = parsedDraft ?? createDraftFromPublished(published, userId);

    return {
      ...draft,
      garden: overlaySharedGardenOperations(draft.garden, sharedOperations),
    };
  }

  private async hasDraft(userId: string) {
    return (await getDoc(this.getDraftDocument(userId))).exists();
  }

  private async getRevisionHistory(
    userId: string,
    published: PublishedGardenRevision,
  ) {
    const snapshot = await getDocs(this.getRevisionsCollection());
    const revisions = snapshot.docs.flatMap(
      (documentSnapshot): PublishedGardenRevision[] => {
        const revision = parsePublishedGardenRevision(
          userId,
          documentSnapshot.data(),
        );

        return revision ? [revision] : [];
      },
    );

    if (!revisions.some((revision) => revision.id === published.id)) {
      revisions.push(published);
    }

    return revisions.sort((left, right) =>
      right.publishedAtIso.localeCompare(left.publishedAtIso),
    );
  }

  private async getSharedOperations(
    userId: string,
    publishedGarden?: Garden,
  ): Promise<SharedGardenOperations> {
    const [
      journalEntries,
      harvestEvents,
      notificationLogs,
      tasks,
      wateringSchedule,
      weatherSnapshots,
    ] = await Promise.all([
      this.getSharedCollectionData('journal'),
      this.getSharedCollectionData('harvests'),
      this.getSharedCollectionData('notifications'),
      this.getSharedCollectionData('tasks'),
      this.getSharedCollectionData('wateringSchedule'),
      this.getSharedCollectionData('weatherSnapshots'),
    ]);
    const operations = mergeSharedGardenOperations({
      harvestEvents: parseHarvestEvents(harvestEvents),
      journalEntries: parseJournalEntries(journalEntries),
      notificationLogs: parseNotificationLogs(notificationLogs),
      tasks: parseTasks(tasks),
      wateringSchedule: parseWateringSchedule(wateringSchedule),
      weatherSnapshots: parseWeatherSnapshots(weatherSnapshots),
    });

    if (hasSharedOperations(operations)) {
      return operations;
    }

    const seededOperations = await this.seedSharedOperations(
      userId,
      publishedGarden,
    );

    if (hasSharedOperations(seededOperations)) {
      await this.commitSharedOperationsSnapshot(seededOperations);
    }

    return seededOperations;
  }

  private async seedSharedOperations(
    userId: string,
    publishedGarden?: Garden,
  ): Promise<SharedGardenOperations> {
    const legacyGarden = await this.getLegacyGarden(userId).catch(() => null);
    const draftSnapshot = await getDoc(this.getDraftDocument(userId)).catch(
      () => null,
    );
    const draft =
      draftSnapshot && publishedGarden
        ? parseGardenDraft(
            userId,
            draftSnapshot.exists() ? draftSnapshot.data() : null,
            createInitialGardenRevisionFromGarden(publishedGarden),
          )
        : null;

    return mergeSharedGardenOperations(
      publishedGarden ? getSharedGardenOperations(publishedGarden) : null,
      draft && !shouldKeepDraftOperations(draft.garden)
        ? getSharedGardenOperations(draft.garden)
        : null,
      legacyGarden ? getSharedGardenOperations(legacyGarden) : null,
    );
  }

  private async commitSharedOperationsPatch({
    base,
    next,
  }: {
    base: SharedGardenOperations;
    next: SharedGardenOperations;
  }) {
    const batch = writeBatch(this.firestore);

    this.writeSharedCollectionPatch(batch, 'journal', {
      base: base.journalEntries,
      next: next.journalEntries,
    });
    this.writeSharedCollectionPatch(batch, 'harvests', {
      base: base.harvestEvents,
      next: next.harvestEvents,
    });
    this.writeSharedCollectionPatch(batch, 'notifications', {
      base: base.notificationLogs,
      next: next.notificationLogs,
    });
    this.writeSharedCollectionPatch(batch, 'tasks', {
      base: base.tasks,
      next: next.tasks,
    });
    this.writeSharedCollectionPatch(batch, 'wateringSchedule', {
      base: base.wateringSchedule,
      next: next.wateringSchedule,
    });
    this.writeSharedCollectionPatch(batch, 'weatherSnapshots', {
      base: base.weatherSnapshots,
      next: next.weatherSnapshots,
    });

    await batch.commit();
  }

  private async commitSharedOperationsSnapshot(
    operations: SharedGardenOperations,
  ) {
    const emptyOperations = createEmptySharedGardenOperations();

    await this.commitSharedOperationsPatch({
      base: emptyOperations,
      next: operations,
    });
  }

  private writeSharedCollectionPatch<T extends { id: string }>(
    batch: ReturnType<typeof writeBatch>,
    collectionName: SharedOperationCollectionName,
    {
      base,
      next,
    }: {
      base: T[];
      next: T[];
    },
  ) {
    const baseById = new Map(base.map((item) => [item.id, item] as const));
    const nextById = new Map(next.map((item) => [item.id, item] as const));

    for (const item of next) {
      const baseItem = baseById.get(item.id);

      if (!baseItem || !sameData(baseItem, item)) {
        batch.set(
          this.getSharedOperationDocument(collectionName, item.id),
          item,
        );
      }
    }

    for (const item of base) {
      if (!nextById.has(item.id)) {
        batch.delete(this.getSharedOperationDocument(collectionName, item.id));
      }
    }
  }

  private async commitDraft(draft: GardenDraft): Promise<void> {
    await setDoc(this.getDraftDocument(draft.userId), {
      baseRevisionId: draft.baseRevisionId,
      garden: prepareDraftGardenForPersistence(draft.garden, draft.userId),
      suggestionDecisions: draft.suggestionDecisions,
      updatedAt: serverTimestamp(),
      updatedAtIso: draft.updatedAtIso,
      userId: draft.userId,
    });
  }

  private async commitPublishedRevision(
    revision: PublishedGardenRevision,
  ): Promise<void> {
    const batch = writeBatch(this.firestore);
    const revisionData = {
      ...revision,
      garden: stripSharedGardenOperations(revision.garden),
      publishedAt: serverTimestamp(),
    };

    batch.set(this.getWorkspaceDocument(), revisionData);
    batch.set(this.getRevisionDocument(revision.id), revisionData);

    await batch.commit();
  }

  private createPublishedRevision({
    action,
    baseGarden,
    baseRevisionId,
    garden,
    publishedByEmail,
    publishedByUserId,
    revertedFromRevisionId,
    suggestionDecisions,
  }: {
    action: PublishedGardenRevision['action'];
    baseGarden: Garden;
    baseRevisionId: string | null;
    garden: Garden;
    publishedByEmail: string;
    publishedByUserId: string;
    revertedFromRevisionId: string | null;
    suggestionDecisions: PublishedGardenRevision['suggestionDecisions'];
  }): PublishedGardenRevision {
    const publishedAtIso = new Date().toISOString();

    return {
      action,
      baseRevisionId,
      changesetSummary: createGardenChangesetSummary(
        baseGarden,
        garden,
        suggestionDecisions,
      ),
      garden,
      id: createRevisionId(),
      publishedAtIso,
      publishedByEmail,
      publishedByUserId,
      revertedFromRevisionId,
      suggestionDecisions,
    };
  }

  private async getLegacyGarden(userId: string): Promise<Garden | null> {
    const snapshot = await getDoc(this.getGardenDocument(userId));

    if (!snapshot.exists()) {
      return readPendingGardenSave(userId);
    }

    const gardenData = snapshot.data();
    const plot = parsePlot(gardenData.plot);
    const [structures, plantings, tasks, journalEntries, harvestEvents, logs] =
      await Promise.all([
        this.getCollectionData(userId, 'structures'),
        this.getCollectionData(userId, 'plantings'),
        this.getCollectionData(userId, 'tasks'),
        this.getCollectionData(userId, 'journal'),
        this.getCollectionData(userId, 'harvests'),
        this.getCollectionData(userId, 'notifications'),
      ]);

    return parseGarden(userId, gardenData, {
      harvestEvents: parseHarvestEvents(harvestEvents),
      journalEntries: parseJournalEntries(journalEntries),
      notificationLogs: parseNotificationLogs(logs),
      plantings: parsePlantings(plantings, plot),
      structures: parseStructures(structures, plot),
      tasks: parseTasks(tasks),
    });
  }

  private async flushPendingSaves() {
    if (isBrowserOffline()) {
      return;
    }

    await Promise.all(
      getPendingGardenSaveUserIds().map((userId) =>
        this.flushPendingSave(userId),
      ),
    );
  }

  private async flushPendingSave(userId: string) {
    if (isBrowserOffline()) {
      return;
    }

    const pendingGarden = readPendingGardenSave(userId);
    const metadata = readPendingGardenSaveMetadata(userId);

    if (!pendingGarden) {
      return;
    }

    if (metadata?.kind === 'sharedOperations') {
      const currentOperations = await this.getSharedOperations(userId);
      const nextOperations = applySharedGardenOperationsPatch({
        base: createEmptySharedGardenOperations(),
        current: currentOperations,
        updated: getSharedGardenOperations(pendingGarden),
      });

      await this.commitSharedOperationsPatch({
        base: currentOperations,
        next: nextOperations,
      });
      clearPendingGardenSave(userId);
      return;
    }

    const published = await this.getPublishedRevision(userId);
    const sharedOperations = await this.getSharedOperations(
      userId,
      published.garden,
    );

    if (
      metadata?.draftBaseRevisionId &&
      metadata.draftBaseRevisionId !== published.id
    ) {
      markPendingGardenSaveConflict(userId, published.id);
      return;
    }

    const draft = await this.getDraft(userId, published, sharedOperations);

    await this.commitDraft({
      ...draft,
      garden: pendingGarden,
      updatedAtIso: metadata?.draftUpdatedAtIso ?? new Date().toISOString(),
    });
    clearPendingGardenSave(userId);
  }

  private async getCollectionData(userId: string, collectionName: string) {
    const snapshot = await getDocs(
      collection(this.firestore, 'gardens', userId, collectionName),
    );

    return snapshot.docs.map((documentSnapshot) => ({
      id: documentSnapshot.id,
      ...documentSnapshot.data(),
    }));
  }

  private async getSharedCollectionData(
    collectionName: SharedOperationCollectionName,
  ) {
    const snapshot = await getDocs(
      this.getSharedOperationsCollection(collectionName),
    );

    return snapshot.docs.map((documentSnapshot) => ({
      id: documentSnapshot.id,
      ...documentSnapshot.data(),
    }));
  }

  private getGardenDocument(userId: string) {
    return doc(this.firestore, 'gardens', userId);
  }

  private getWorkspaceDocument() {
    return doc(this.firestore, 'gardenWorkspaces', 'main');
  }

  private getRevisionsCollection() {
    return collection(this.firestore, 'gardenWorkspaces', 'main', 'revisions');
  }

  private getSharedOperationsCollection(
    collectionName: SharedOperationCollectionName,
  ) {
    return collection(
      this.firestore,
      'gardenWorkspaces',
      'main',
      collectionName,
    );
  }

  private getSharedOperationDocument(
    collectionName: SharedOperationCollectionName,
    documentId: string,
  ) {
    return doc(
      this.firestore,
      'gardenWorkspaces',
      'main',
      collectionName,
      documentId,
    );
  }

  private getRevisionDocument(revisionId: string) {
    return doc(
      this.firestore,
      'gardenWorkspaces',
      'main',
      'revisions',
      revisionId,
    );
  }

  private getDraftDocument(userId: string) {
    return doc(this.firestore, 'gardenWorkspaces', 'main', 'drafts', userId);
  }
}

function createRevisionId() {
  const suffix =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  return `revision-${suffix}`;
}

function createInitialGardenRevisionFromGarden(
  garden: Garden,
): PublishedGardenRevision {
  return {
    ...createInitialGardenRevision(garden.userId),
    garden,
  };
}

function prepareDraftGardenForPersistence(garden: Garden, userId: string) {
  const preparedGarden = prepareGardenForUser(garden, userId);

  return shouldKeepDraftOperations(preparedGarden)
    ? preparedGarden
    : stripSharedGardenOperations(preparedGarden);
}

function shouldKeepDraftOperations(garden: Garden) {
  return garden.name === 'Sample Kitchen Garden';
}

function hasSharedOperations(operations: SharedGardenOperations) {
  return (
    operations.harvestEvents.length > 0 ||
    operations.journalEntries.length > 0 ||
    operations.notificationLogs.length > 0 ||
    operations.tasks.length > 0 ||
    operations.wateringSchedule.length > 0 ||
    operations.weatherSnapshots.length > 0
  );
}

function sameData(left: unknown, right: unknown) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function shouldQueueSaveFailure(error: unknown) {
  if (isBrowserOffline()) {
    return true;
  }

  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 'unavailable'
  );
}

const sharedOperationCollectionNames = [
  'journal',
  'harvests',
  'notifications',
  'tasks',
  'wateringSchedule',
  'weatherSnapshots',
] as const;

type SharedOperationCollectionName =
  (typeof sharedOperationCollectionNames)[number];
