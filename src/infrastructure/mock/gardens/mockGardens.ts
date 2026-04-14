import type { GardenSummary } from '../../../domain/gardens/types';

export const mockGardens: GardenSummary[] = [
  {
    dimensions: {
      height: 32,
      unit: 'ft',
      width: 18,
    },
    id: 'north-lot',
    memberRole: 'owner',
    name: 'North Lot',
    plotCount: 6,
    slug: 'north-lot',
    timezone: 'America/Detroit',
    updatedLabel: 'Updated for spring planning',
  },
  {
    dimensions: {
      height: 20,
      unit: 'ft',
      width: 12,
    },
    id: 'alley-beds',
    memberRole: 'editor',
    name: 'Alley Beds',
    plotCount: 4,
    slug: 'alley-beds',
    timezone: 'America/Detroit',
    updatedLabel: 'Shared with two members',
  },
  {
    dimensions: {
      height: 24,
      unit: 'ft',
      width: 10,
    },
    id: 'roof-boxes',
    memberRole: 'viewer',
    name: 'Roof Boxes',
    plotCount: 3,
    slug: 'roof-boxes',
    timezone: 'America/Detroit',
    updatedLabel: 'Read-only trial space',
  },
];
