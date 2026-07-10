import type { PartialWaterApplication } from '../domain/watering';
import {
  correctWaterApplication,
  createWaterApplication,
} from './wateringApplicationRecords';

const nowIso = '2026-07-09T16:00:00.000Z';
const timezone = 'America/Detroit';

describe('watering application records', () => {
  it('creates an actor-attributed partial application without collapsing its outcome', () => {
    const application = createWaterApplication({
      input: {
        amount: { unit: 'inches', value: 0.25 },
        cropGroupId: 'tomato-group',
        method: 'hand',
        occurredOn: '2026-07-09',
        outcome: 'partial',
        recommendationId: 'recommendation-1',
        skipReason: null,
      },
      nowIso,
      recommendation: undefined,
      timezone,
      userId: 'user-a',
    });

    expect(application).toMatchObject({
      appliedAtIso: nowIso,
      cropGroupId: 'tomato-group',
      outcome: 'partial',
      recordedAtIso: nowIso,
      recordedByUserId: 'user-a',
      revision: 1,
    });
  });

  it('corrects in place with revision plus one while preserving actor and crop', () => {
    const original: PartialWaterApplication = {
      amount: { depthInches: 0.25, unit: 'inches' },
      appliedAtIso: '2026-07-08T16:00:00.000Z',
      cropGroupId: 'tomato-group',
      efficiency: { confidence: 'medium', fraction: 0.8, source: 'estimated' },
      id: 'water-1',
      method: 'hand',
      outcome: 'partial',
      recordedAtIso: '2026-07-08T16:05:00.000Z',
      recordedByUserId: 'user-a',
      revision: 2,
    };

    const corrected = correctWaterApplication({
      area: { reliability: 'geometry', squareFeet: 12 },
      input: {
        amount: { unit: 'gallons', value: 2.5 },
        applicationId: original.id,
        method: 'drip',
        occurredOn: '2026-07-07',
        outcome: 'applied',
        skipReason: null,
      },
      nowIso,
      original,
      timezone,
    });

    expect(corrected).toMatchObject({
      amount: {
        area: { reliability: 'geometry', squareFeet: 12 },
        gallons: 2.5,
        unit: 'gallons',
      },
      cropGroupId: original.cropGroupId,
      id: original.id,
      method: 'drip',
      outcome: 'applied',
      recordedAtIso: nowIso,
      recordedByUserId: original.recordedByUserId,
      revision: 3,
    });
    expect(corrected.appliedAtIso).toBe('2026-07-07T16:00:00.000Z');
  });
});
