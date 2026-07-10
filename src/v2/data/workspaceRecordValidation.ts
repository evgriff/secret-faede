import type {
  DraftPlanRecord,
  GardenPlan,
  PlanRevision,
  PublishedPlanRecord,
} from '../domain';
import { assertValidGardenPlan } from './planValidation';
import {
  assertExactKeys,
  assertIso,
  assertText,
  requireRecord,
} from './recordValidationSupport';

export function assertValidPublishedRecord(
  value: unknown,
  expectedRevisionId?: string,
): asserts value is PublishedPlanRecord {
  const record = requireRecord(value, 'Published plan record');
  assertExactKeys(
    record,
    ['plan', 'publishedAtIso', 'publishedByUserId', 'revisionId'],
    'Published plan record',
  );
  assertValidGardenPlan(record.plan as GardenPlan);
  assertText(record.revisionId, 'Published revision id', 1, 500);
  assertText(record.publishedByUserId, 'Publisher user id', 1, 128);
  assertIso(record.publishedAtIso, 'Publication time');
  if (expectedRevisionId && record.revisionId !== expectedRevisionId) {
    throw new Error('Published plan does not match workspace metadata.');
  }
}

export function assertValidDraftRecord(
  value: unknown,
  userId: string,
): asserts value is DraftPlanRecord {
  const record = requireRecord(value, 'Draft plan record');
  assertExactKeys(
    record,
    ['baseRevisionId', 'plan', 'updatedAtIso', 'userId'],
    'Draft plan record',
  );
  assertValidGardenPlan(record.plan as GardenPlan);
  assertText(record.baseRevisionId, 'Draft base revision id', 1, 500);
  assertIso(record.updatedAtIso, 'Draft update time');
  if (record.userId !== userId)
    throw new Error('Private draft owner mismatch.');
}

export function assertValidPlanRevision(
  value: unknown,
): asserts value is PlanRevision {
  const record = requireRecord(value, 'Plan revision');
  assertExactKeys(
    record,
    [
      'changeSummary',
      'plan',
      'publishedAtIso',
      'publishedByUserId',
      'revisionId',
    ],
    'Plan revision',
  );
  const publication = {
    plan: record.plan,
    publishedAtIso: record.publishedAtIso,
    publishedByUserId: record.publishedByUserId,
    revisionId: record.revisionId,
  };
  assertValidPublishedRecord(publication);
  assertText(record.changeSummary, 'Revision change summary', 1, 500);
}
