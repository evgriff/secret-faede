import type {
  Garden,
  GardenRepository,
  GardenWorkspaceListener,
  GardenWorkspaceUnsubscribe,
  SaveSharedGardenOperationsRequest,
} from '../../../domain/gardens/GardenRepository';
import { parseGarden } from '../../../domain/gardens/GardenRepository';
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
import {
  readJsonStorageValue,
  removeStorageValue,
  writeStorageValue,
  writeJsonStorageValue,
} from '../../../shared/lib/storage';

export class MockGardenRepository implements GardenRepository {
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
    const basePublished = readPublishedRevision(userId);
    const sharedOperations = readSharedOperations(userId, basePublished);
    const published = {
      ...basePublished,
      garden: overlaySharedGardenOperations(
        basePublished.garden,
        sharedOperations,
      ),
    };
    const draft = readDraft(userId, published, sharedOperations);
    const hasDraft = Boolean(
      readJsonStorageValue<unknown>(getDraftKey(userId)),
    );
    const revisionHistory = readRevisionHistory(userId, published);
    const draftSummary = createGardenChangesetSummary(
      prepareGardenForUser(published.garden, userId),
      draft.garden,
      draft.suggestionDecisions,
    );

    return {
      draft,
      draftChanged: hasGardenChanges(draftSummary),
      draftIsStale: draft.baseRevisionId !== published.id,
      hasDraft,
      published,
      revisions: revisionHistory,
    };
  }

  async saveDraft(draft: GardenDraft): Promise<void> {
    writeJsonStorageValue(getDraftKey(draft.userId), {
      ...draft,
      garden: prepareDraftGardenForPersistence(draft.garden, draft.userId),
      updatedAtIso: draft.updatedAtIso || new Date().toISOString(),
    });
    notifyMockWorkspaceChanged();
  }

  async discardDraft(userId: string): Promise<GardenDraft> {
    const published = readPublishedRevision(userId);
    const draft = createDraftFromPublished(published, userId);

    writeJsonStorageValue(getDraftKey(userId), draft);
    notifyMockWorkspaceChanged();
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

    const baseGarden = prepareGardenForUser(
      workspace.published.garden,
      request.userId,
    );
    const revision = createPublishedRevision({
      action: 'publish',
      baseGarden,
      baseRevisionId: workspace.draft.baseRevisionId,
      garden: stripSharedGardenOperations(workspace.draft.garden),
      publishedByEmail: request.userEmail,
      publishedByUserId: request.userId,
      revertedFromRevisionId: null,
      suggestionDecisions: workspace.draft.suggestionDecisions,
    });

    writePublishedRevision(revision);
    writeRevision(revision);

    const draft = {
      ...createDraftFromPublished(revision, request.userId),
      updatedAtIso: revision.publishedAtIso,
    };

    writeJsonStorageValue(getDraftKey(request.userId), draft);
    notifyMockWorkspaceChanged();

    const nextWorkspace = await this.getWorkspace(request.userId);

    return {
      conflict: null,
      revision,
      status: 'published',
      workspace: nextWorkspace,
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

    const baseGarden = prepareGardenForUser(
      workspace.published.garden,
      request.userId,
    );
    const revertedGarden = prepareGardenForUser(
      targetRevision.garden,
      request.userId,
    );
    const revision = createPublishedRevision({
      action: 'revert',
      baseGarden,
      baseRevisionId: workspace.published.id,
      garden: stripSharedGardenOperations(revertedGarden),
      publishedByEmail: request.userEmail,
      publishedByUserId: request.userId,
      revertedFromRevisionId: targetRevision.id,
      suggestionDecisions: [],
    });

    writePublishedRevision(revision);
    writeRevision(revision);

    const draft = {
      ...createDraftFromPublished(revision, request.userId),
      updatedAtIso: revision.publishedAtIso,
    };

    writeJsonStorageValue(getDraftKey(request.userId), draft);
    notifyMockWorkspaceChanged();

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
    const currentOperations = readSharedOperations(userId);
    const nextOperations = applySharedGardenOperationsPatch({
      base: getSharedGardenOperations(baseGarden),
      current: currentOperations,
      updated: getSharedGardenOperations(authoredGarden),
    });

    writeSharedOperations(nextOperations);
    notifyMockWorkspaceChanged();

    return overlaySharedGardenOperations(authoredGarden, nextOperations);
  }

  subscribeWorkspace(
    userId: string,
    listener: GardenWorkspaceListener,
  ): GardenWorkspaceUnsubscribe {
    let active = true;

    const emit = () => {
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

    const handleStorage = (event: StorageEvent) => {
      if (
        event.key === sharedOperationsKey ||
        event.key === workspaceSignalKey ||
        event.key === publishedKey ||
        event.key === getDraftKey(userId)
      ) {
        emit();
      }
    };
    const handleLocalEvent = () => emit();

    emit();

    if (typeof window !== 'undefined') {
      window.addEventListener('storage', handleStorage);
      window.addEventListener(mockWorkspaceEventName, handleLocalEvent);
    }

    return () => {
      active = false;

      if (typeof window !== 'undefined') {
        window.removeEventListener('storage', handleStorage);
        window.removeEventListener(mockWorkspaceEventName, handleLocalEvent);
      }
    };
  }
}

function readPublishedRevision(userId: string) {
  const storedRevision = readJsonStorageValue<unknown>(publishedKey);
  const parsedRevision = parsePublishedGardenRevision(userId, storedRevision);

  if (parsedRevision) {
    return parsedRevision;
  }

  const legacyGarden = readLegacyGarden(userId);
  const revision = legacyGarden
    ? createPublishedRevision({
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

  writePublishedRevision(revision);
  writeRevision(revision);
  return revision;
}

function readDraft(
  userId: string,
  published: PublishedGardenRevision,
  sharedOperations: SharedGardenOperations,
) {
  const storedDraft = readJsonStorageValue<unknown>(getDraftKey(userId));
  const parsedDraft = parseGardenDraft(userId, storedDraft, published);

  const draft = parsedDraft ?? createDraftFromPublished(published, userId);

  return {
    ...draft,
    garden: overlaySharedGardenOperations(draft.garden, sharedOperations),
  };
}

function readRevisionHistory(
  userId: string,
  published: PublishedGardenRevision,
) {
  const revisionIds = readJsonStorageValue<string[]>(revisionIndexKey) ?? [];
  const revisions = revisionIds.flatMap(
    (revisionId): PublishedGardenRevision[] => {
      const revision = parsePublishedGardenRevision(
        userId,
        readJsonStorageValue<unknown>(getRevisionKey(revisionId)),
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

function writePublishedRevision(revision: PublishedGardenRevision) {
  writeJsonStorageValue(publishedKey, {
    ...revision,
    garden: stripSharedGardenOperations(revision.garden),
  });
  notifyMockWorkspaceChanged();
}

function writeRevision(revision: PublishedGardenRevision) {
  const storedRevision = {
    ...revision,
    garden: stripSharedGardenOperations(revision.garden),
  };
  const revisionIds = readJsonStorageValue<string[]>(revisionIndexKey) ?? [];
  const nextRevisionIds = [
    revision.id,
    ...revisionIds.filter((revisionId) => revisionId !== revision.id),
  ].slice(0, 24);

  writeJsonStorageValue(getRevisionKey(revision.id), storedRevision);
  writeJsonStorageValue(revisionIndexKey, nextRevisionIds);
}

function createPublishedRevision({
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

function readLegacyGarden(userId: string) {
  const storedGarden = readJsonStorageValue<unknown>(
    getLegacyGardenKey(userId),
  );

  if (!storedGarden) {
    return null;
  }

  removeStorageValue(getLegacyGardenKey(userId));
  return parseGarden(userId, storedGarden);
}

function readSharedOperations(
  userId: string,
  published?: PublishedGardenRevision,
): SharedGardenOperations {
  const storedOperations =
    readJsonStorageValue<SharedGardenOperations>(sharedOperationsKey);

  if (storedOperations) {
    return mergeSharedGardenOperations(storedOperations);
  }

  const seededOperations = seedSharedOperations(userId, published);

  if (hasSharedOperations(seededOperations)) {
    writeSharedOperations(seededOperations);
  }

  return seededOperations;
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

function seedSharedOperations(
  userId: string,
  published?: PublishedGardenRevision,
) {
  return mergeSharedGardenOperations(
    published ? getSharedGardenOperations(published.garden) : null,
    ...readAllDraftOperationSources(published),
    readLegacyGardenOperationSource(userId),
  );
}

function readAllDraftOperationSources(
  published?: PublishedGardenRevision,
): SharedGardenOperations[] {
  if (typeof window === 'undefined') {
    return [];
  }

  const storage = window.localStorage;
  const sources: SharedGardenOperations[] = [];

  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);

    if (!key?.startsWith(draftKeyPrefix)) {
      continue;
    }

    const storedDraft = readJsonStorageValue<{
      garden?: unknown;
      userId?: unknown;
    }>(key);
    const draftUserId =
      typeof storedDraft?.userId === 'string' ? storedDraft.userId : null;

    if (!draftUserId || !published) {
      continue;
    }

    const draft = parseGardenDraft(draftUserId, storedDraft, published);

    if (draft) {
      if (!shouldKeepDraftOperations(draft.garden)) {
        sources.push(getSharedGardenOperations(draft.garden));
      }
    }
  }

  return sources;
}

function readLegacyGardenOperationSource(userId: string) {
  const storedGarden = readJsonStorageValue<unknown>(
    getLegacyGardenKey(userId),
  );
  const parsedGarden = storedGarden ? parseGarden(userId, storedGarden) : null;

  return parsedGarden
    ? getSharedGardenOperations(parsedGarden)
    : createEmptySharedGardenOperations();
}

function writeSharedOperations(operations: SharedGardenOperations) {
  writeJsonStorageValue(sharedOperationsKey, operations);
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

function notifyMockWorkspaceChanged() {
  writeStorageValue(workspaceSignalKey, new Date().toISOString());

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(mockWorkspaceEventName));
  }
}

function createRevisionId() {
  const suffix =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  return `revision-${suffix}`;
}

const publishedKey = 'secret-faeries.garden.published.v1';
const revisionIndexKey = 'secret-faeries.garden.revisions.v1';
const sharedOperationsKey = 'secret-faeries.garden.shared-operations.v1';
const workspaceSignalKey = 'secret-faeries.garden.workspace-signal.v1';
const mockWorkspaceEventName = 'secret-faeries:workspace-changed';
const draftKeyPrefix = 'secret-faeries.garden.draft.v1:';

function getRevisionKey(revisionId: string) {
  return `secret-faeries.garden.revision.v1:${encodeURIComponent(revisionId)}`;
}

function getDraftKey(userId: string) {
  return `${draftKeyPrefix}${encodeURIComponent(userId)}`;
}

function getLegacyGardenKey(userId: string) {
  return `secret-faeries.garden.v1:${encodeURIComponent(userId)}`;
}
