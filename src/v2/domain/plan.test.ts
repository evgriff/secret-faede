import { describe, expect, it } from 'vitest';

import {
  getPlantingGroupLabel,
  hasOperationalGardenLocation,
  isValidLocalDate,
  PLAN_SCHEMA_VERSION,
  resetPlantingWateringStage,
  transitionPlantingLifecycle,
  type GardenPlan,
} from './plan';
import { makePlanting, makeStructure } from './watering/wateringTestFixtures';

describe('planting group labels', () => {
  it('includes duplicate crop ordinal and growing-area label', () => {
    const first = makePlanting('tomato-first', 'Tomato', {
      cropId: 'tomato',
    });
    const second = {
      ...structuredClone(first),
      id: 'tomato-second',
      instances: first.instances.map((instance) => ({
        ...instance,
        id: `${instance.id}-second`,
      })),
    };
    const structure = makeStructure();
    const plan: GardenPlan = {
      createdAtIso: '2026-07-09T12:00:00.000Z',
      id: 'garden-main',
      name: 'Home garden',
      plantings: [first, second],
      plot: {
        climate: {
          firstFrost: '10-15',
          hardinessZone: '6b',
          lastFrost: '04-30',
        },
        depthFt: 10,
        location: {
          coordinates: null,
          label: '',
          query: '',
          timezone: 'UTC',
        },
        northDegrees: 0,
        snapFt: 0.125,
        widthFt: 10,
      },
      reviewDecisions: [],
      schemaVersion: PLAN_SCHEMA_VERSION,
      setupCompleted: true,
      structures: [structure],
      updatedAtIso: '2026-07-09T12:00:00.000Z',
    };

    expect(getPlantingGroupLabel(plan, first)).toBe(
      `${first.cropName} group 1 in ${structure.label}`,
    );
    expect(getPlantingGroupLabel(plan, second)).toBe(
      `${second.cropName} group 2 in ${structure.label}`,
    );
  });
});

describe('planting watering-stage lifecycle', () => {
  it('advances a lifecycle fallback without overwriting observed stages', () => {
    const fallback = makePlanting('fallback', 'Bean', {
      lifecycle: 'planted',
      wateringStage: 'establishing',
      wateringStageSource: 'lifecycleFallback',
    });
    expect(transitionPlantingLifecycle(fallback, 'growing')).toMatchObject({
      lifecycle: 'growing',
      wateringStage: 'mature',
      wateringStageSource: 'lifecycleFallback',
    });

    const observed = {
      ...fallback,
      wateringStage: 'flowering' as const,
      wateringStageSource: 'plantingEvent' as const,
    };
    expect(transitionPlantingLifecycle(observed, 'growing')).toMatchObject({
      lifecycle: 'growing',
      wateringStage: 'flowering',
      wateringStageSource: 'plantingEvent',
    });
  });

  it('resets an observed stage to the deterministic lifecycle fallback', () => {
    const observed = makePlanting('observed', 'Tomato', {
      lifecycle: 'harvestReady',
      wateringStage: 'flowering',
      wateringStageSource: 'manual',
    });

    expect(resetPlantingWateringStage(observed)).toMatchObject({
      wateringStage: 'fruiting',
      wateringStageSource: 'lifecycleFallback',
    });
  });
});

describe('local planting dates', () => {
  it('accepts only real YYYY-MM-DD calendar dates', () => {
    expect(isValidLocalDate('2026-07-09')).toBe(true);
    expect(isValidLocalDate('2026-02-29')).toBe(false);
    expect(isValidLocalDate('2024-02-29')).toBe(true);
    expect(isValidLocalDate('07/09/2026')).toBe(false);
  });
});

describe('operational garden location', () => {
  it('requires bounded coordinates and an IANA timezone together', () => {
    expect(
      hasOperationalGardenLocation({
        coordinates: { latitude: 42.3314, longitude: -83.0458 },
        label: 'Back garden',
        query: 'Detroit, MI',
        timezone: 'America/Detroit',
      }),
    ).toBe(true);
    expect(
      hasOperationalGardenLocation({
        coordinates: null,
        label: 'Back garden',
        query: 'Detroit, MI',
        timezone: 'America/Detroit',
      }),
    ).toBe(false);
    expect(
      hasOperationalGardenLocation({
        coordinates: { latitude: 42.3314, longitude: -83.0458 },
        label: 'Back garden',
        query: 'Detroit, MI',
        timezone: 'Detroit-ish',
      }),
    ).toBe(false);
  });
});
