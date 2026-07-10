import {
  type DraftPlanRecord,
  type PlanRevision,
  type PublishedPlanRecord,
} from '../domain';
import type { PersistedWorkspaceState } from './GardenRepository';
import {
  assertValidHarvestRecord,
  assertValidJournalRecord,
  assertValidTaskRecord,
  assertValidWaterApplicationRecord,
} from './operationRecordValidation';
import { requireArray, requireRecord } from './recordValidationSupport';
import { currentWateringRecommendations } from './wateringRecommendationValidation';
import { assertValidWateringRecommendationRecord } from './wateringRecommendationRecordValidation';
import {
  assertValidDraftRecord,
  assertValidPlanRevision,
  assertValidPublishedRecord,
} from './workspaceRecordValidation';

export function normalizePersistedWorkspaceState(
  value: unknown,
): PersistedWorkspaceState {
  const state = asRecord(value);
  const published = readPublished(state.published);

  return {
    drafts: readDrafts(state.drafts),
    harvests: readItems(state.harvests, 'harvests', decodeHarvest),
    journal: readItems(state.journal, 'journal', decodeJournal),
    published,
    revisions: readRevisions(state.revisions, published),
    tasks: readItems(state.tasks, 'tasks', decodeTask),
    waterApplications: readItems(
      state.waterApplications,
      'water applications',
      decodeWaterApplication,
    ),
    wateringRecommendations: currentWateringRecommendations(
      readItems(
        state.wateringRecommendations,
        'watering recommendations',
        decodeWateringRecommendation,
      ),
      published.revisionId,
    ),
  };
}

function readPublished(value: unknown): PublishedPlanRecord {
  assertValidPublishedRecord(value);
  return structuredClone(value);
}

function readDrafts(value: unknown): Record<string, DraftPlanRecord> {
  const drafts: Record<string, DraftPlanRecord> = {};
  if (value === undefined) return drafts;
  let records: Record<string, unknown>;
  try {
    records = requireRecord(value, 'Saved drafts');
  } catch {
    return drafts;
  }
  for (const [userId, candidate] of Object.entries(records)) {
    try {
      assertValidDraftRecord(candidate, userId);
      drafts[userId] = structuredClone(candidate);
    } catch {
      // A corrupt private draft must not make the shared published plan unreadable.
    }
  }
  return drafts;
}

function readRevisions(
  value: unknown,
  published: PublishedPlanRecord,
): PlanRevision[] {
  const candidates =
    value === undefined
      ? []
      : requireArray(value, 'Saved plan revisions', 10_000);
  const revisionIds = new Set<string>();
  const revisions = candidates.map((candidate) => {
    const revision = decodeRevision(candidate);
    if (revisionIds.has(revision.revisionId)) {
      throw new Error(
        `Saved plan revisions contains duplicate id ${revision.revisionId}.`,
      );
    }
    revisionIds.add(revision.revisionId);
    return structuredClone(revision);
  });
  if (
    revisions.some((revision) => revision.revisionId === published.revisionId)
  ) {
    return revisions.slice(0, 100);
  }
  return [
    { ...structuredClone(published), changeSummary: 'Recovered publication' },
    ...revisions,
  ].slice(0, 100);
}

function readItems<T extends { id: string }>(
  value: unknown,
  label: string,
  decode: (value: unknown) => T,
): T[] {
  const ids = new Set<string>();
  const candidates =
    value === undefined ? [] : requireArray(value, `Saved ${label}`, 10_000);
  return candidates.map((candidate) => {
    const decoded = decode(candidate);
    if (ids.has(decoded.id)) {
      throw new Error(`Saved ${label} contains duplicate id ${decoded.id}.`);
    }
    ids.add(decoded.id);
    return structuredClone(decoded);
  });
}

function asRecord(value: unknown): Record<string, unknown> {
  return requireRecord(value, 'Saved workspace');
}

function decodeRevision(value: unknown) {
  assertValidPlanRevision(value);
  return value;
}

function decodeJournal(value: unknown) {
  assertValidJournalRecord(value);
  return value;
}

function decodeHarvest(value: unknown) {
  assertValidHarvestRecord(value);
  return value;
}

function decodeTask(value: unknown) {
  assertValidTaskRecord(value);
  return value;
}

function decodeWaterApplication(value: unknown) {
  assertValidWaterApplicationRecord(value);
  return value;
}

function decodeWateringRecommendation(value: unknown) {
  assertValidWateringRecommendationRecord(value);
  return value;
}
