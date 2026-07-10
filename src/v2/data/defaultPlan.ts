import { PLAN_SCHEMA_VERSION, type GardenPlan } from '../domain';

export function createEmptyGardenPlan(now = new Date()): GardenPlan {
  const nowIso = now.toISOString();
  return {
    createdAtIso: nowIso,
    id: 'garden-main',
    name: 'Home garden',
    plantings: [],
    plot: {
      climate: {
        firstFrost: '10-15',
        hardinessZone: '6b',
        lastFrost: '04-30',
      },
      depthFt: 8,
      location: {
        coordinates: null,
        label: '',
        query: '',
        timezone: 'UTC',
      },
      northDegrees: 0,
      snapFt: 0.125,
      widthFt: 12,
    },
    reviewDecisions: [],
    schemaVersion: PLAN_SCHEMA_VERSION,
    setupCompleted: false,
    structures: [],
    updatedAtIso: nowIso,
  };
}
