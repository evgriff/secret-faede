import type {
  Garden,
  GardenRepository,
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
  readJsonStorageValue,
  removeStorageValue,
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
    const published = readPublishedRevision(userId);
    const draft = readDraft(userId, published);
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
      garden: prepareGardenForUser(draft.garden, draft.userId),
      updatedAtIso: draft.updatedAtIso || new Date().toISOString(),
    });
  }

  async discardDraft(userId: string): Promise<GardenDraft> {
    const published = readPublishedRevision(userId);
    const draft = createDraftFromPublished(published, userId);

    writeJsonStorageValue(getDraftKey(userId), draft);
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
      garden: workspace.draft.garden,
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
      garden: revertedGarden,
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

    return {
      conflict: null,
      revision,
      status: 'published',
      workspace: await this.getWorkspace(request.userId),
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

function readDraft(userId: string, published: PublishedGardenRevision) {
  const storedDraft = readJsonStorageValue<unknown>(getDraftKey(userId));
  const parsedDraft = parseGardenDraft(userId, storedDraft, published);

  return parsedDraft ?? createDraftFromPublished(published, userId);
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
  writeJsonStorageValue(publishedKey, revision);
}

function writeRevision(revision: PublishedGardenRevision) {
  const revisionIds = readJsonStorageValue<string[]>(revisionIndexKey) ?? [];
  const nextRevisionIds = [
    revision.id,
    ...revisionIds.filter((revisionId) => revisionId !== revision.id),
  ].slice(0, 24);

  writeJsonStorageValue(getRevisionKey(revision.id), revision);
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

function createRevisionId() {
  const suffix =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  return `revision-${suffix}`;
}

const publishedKey = 'secret-faede.garden.published.v1';
const revisionIndexKey = 'secret-faede.garden.revisions.v1';

function getRevisionKey(revisionId: string) {
  return `secret-faede.garden.revision.v1:${encodeURIComponent(revisionId)}`;
}

function getDraftKey(userId: string) {
  return `secret-faede.garden.draft.v1:${encodeURIComponent(userId)}`;
}

function getLegacyGardenKey(userId: string) {
  return `secret-faede.garden.v1:${encodeURIComponent(userId)}`;
}
