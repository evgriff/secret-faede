import type {
  PlantingLifecycleStatus,
  PlantStatusPhoto,
  PlantSupportType,
} from '../../../domain/gardens/GardenRepository';

export const lifecycleStates: PlantingLifecycleStatus[] = [
  'planned',
  'planted',
  'growing',
  'harvest-ready',
  'harvested',
  'removed',
];

export const supportTypes: PlantSupportType[] = [
  'none',
  'cage',
  'stake',
  'stakeAndWeave',
  'netting',
  'rowCover',
  'custom',
];

export function createPictureSlot(
  plantId: string,
  index: number,
): PlantStatusPhoto {
  return {
    contentType: 'image/*',
    downloadUrl: null,
    fileName: `Picture slot ${index}`,
    id: `${plantId}:photo-slot-${index}`,
    sizeBytes: null,
    storagePath: null,
    uploadedAtIso: null,
  };
}

export function formatLifecycle(status: PlantingLifecycleStatus) {
  const labels: Record<PlantingLifecycleStatus, string> = {
    growing: 'Growing',
    'harvest-ready': 'Harvest-ready',
    harvested: 'Harvested',
    planned: 'Planned',
    planted: 'Planted',
    removed: 'Removed',
  };

  return labels[status];
}

export function formatSupportType(type: PlantSupportType) {
  const labels: Record<PlantSupportType, string> = {
    cage: 'Cage',
    custom: 'Custom',
    netting: 'Netting',
    none: 'None',
    rowCover: 'Row cover',
    stake: 'Stake',
    stakeAndWeave: 'Stake and weave',
  };

  return labels[type];
}
