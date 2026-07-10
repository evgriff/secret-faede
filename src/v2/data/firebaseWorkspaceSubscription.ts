import {
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  type DocumentData,
  type Firestore,
  type QuerySnapshot,
} from 'firebase/firestore';

import type {
  GardenIssue,
  GardenTask,
  GardenWorkspaceView,
  HarvestRecord,
  JournalEntry,
  PlanRevision,
  WaterApplication,
  WateringRecommendation,
} from '../domain';
import type { WorkspaceSubscription } from './GardenRepository';
import {
  assertValidHarvestRecord,
  assertValidJournalRecord,
  assertValidTaskRecord,
  assertValidWaterApplicationRecord,
} from './operationRecordValidation';
import { assertValidWateringRecommendationRecord } from './wateringRecommendationRecordValidation';
import {
  assertValidDraftRecord,
  assertValidPlanRevision,
  assertValidPublishedRecord,
} from './workspaceRecordValidation';
import { currentWateringRecommendations } from './wateringRecommendationValidation';

export function subscribeFirebaseWorkspace(
  db: Firestore,
  userId: string,
  onChange: (workspace: GardenWorkspaceView) => void,
  onError: (error: Error) => void,
): WorkspaceSubscription {
  const current: Partial<GardenWorkspaceView> = {
    operations: {
      harvests: [],
      journal: [],
      tasks: [],
      waterApplications: [],
      wateringRecommendations: [],
    },
    recentRevisions: [],
  };
  const required = [
    'published',
    'draft',
    'revisions',
    'journal',
    'harvests',
    'tasks',
    'waterApplications',
    'wateringRecommendations',
  ];
  const ready = new Set<string>();
  let closed = false;
  const emit = () => {
    if (!closed && required.every((key) => ready.has(key))) {
      const next = structuredClone(current as GardenWorkspaceView);
      next.operations.wateringRecommendations = currentWateringRecommendations(
        next.operations.wateringRecommendations,
        next.published.revisionId,
      );
      onChange(next);
    }
  };
  const fail = (error: Error) => !closed && onError(error);
  const mark =
    <T>(key: string, apply: (items: T[]) => void) =>
    (items: T[]) => {
      apply(items);
      ready.add(key);
      emit();
    };
  const operations = current.operations!;

  const unsubs = [
    onSnapshot(
      doc(db, 'gardenWorkspaces', 'main', 'plans', 'published'),
      (snapshot) => {
        if (!snapshot.exists()) {
          fail(new Error('This garden workspace must be migrated to v2.'));
          return;
        }
        try {
          const published: unknown = snapshot.data();
          assertValidPublishedRecord(published);
          current.published = published;
          ready.add('published');
          emit();
        } catch (error) {
          fail(toError(error));
        }
      },
      fail,
    ),
    onSnapshot(
      doc(db, 'gardenWorkspaces', 'main', 'drafts', userId),
      (snapshot) => {
        try {
          if (snapshot.exists()) {
            const draft: unknown = snapshot.data();
            assertValidDraftRecord(draft, userId);
            current.draft = draft;
          } else {
            current.draft = null;
          }
          ready.add('draft');
          emit();
        } catch (error) {
          fail(toError(error));
        }
      },
      fail,
    ),
    subscribeCollection<PlanRevision>(
      db,
      'revisions',
      'publishedAtIso',
      20,
      decodePlanRevision,
      mark('revisions', (items) => {
        current.recentRevisions = items;
      }),
      fail,
    ),
    subscribeCollection<GardenIssue | JournalEntry>(
      db,
      'journal',
      'createdAtIso',
      250,
      decodeJournal,
      mark('journal', (items) => {
        operations.journal = items;
      }),
      fail,
    ),
    subscribeCollection<HarvestRecord>(
      db,
      'harvests',
      'occurredOn',
      250,
      decodeHarvest,
      mark('harvests', (items) => {
        operations.harvests = items;
      }),
      fail,
    ),
    subscribeCollection<GardenTask>(
      db,
      'tasks',
      'dueOn',
      300,
      decodeTask,
      mark('tasks', (items) => {
        operations.tasks = items;
      }),
      fail,
    ),
    subscribeCollection<WaterApplication>(
      db,
      'waterApplications',
      'appliedAtIso',
      500,
      decodeWaterApplication,
      mark('waterApplications', (items) => {
        operations.waterApplications = items;
      }),
      fail,
    ),
    subscribeCollection<WateringRecommendation>(
      db,
      'wateringRecommendations',
      'calculatedAtIso',
      300,
      decodeWateringRecommendation,
      mark('wateringRecommendations', (items) => {
        operations.wateringRecommendations = items;
      }),
      fail,
    ),
  ];

  return {
    unsubscribe: () => {
      closed = true;
      unsubs.forEach((unsubscribe) => unsubscribe());
    },
  };
}

function subscribeCollection<T>(
  db: Firestore,
  name: string,
  orderField: string,
  maximum: number,
  decode: (value: unknown, documentId: string) => T,
  onChange: (items: T[]) => void,
  onError: (error: Error) => void,
) {
  return onSnapshot(
    query(
      collection(db, 'gardenWorkspaces', 'main', name),
      orderBy(orderField, 'desc'),
      limit(maximum),
    ),
    (snapshot: QuerySnapshot<DocumentData>) => {
      try {
        onChange(snapshot.docs.map((entry) => decode(entry.data(), entry.id)));
      } catch (error) {
        onError(toError(error));
      }
    },
    onError,
  );
}

function toError(error: unknown) {
  return error instanceof Error ? error : new Error(String(error));
}

function decodePlanRevision(value: unknown) {
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
