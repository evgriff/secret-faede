export * from './models';
export * from './plantMaturity';
export * from './plantingGeometry';
export * from './plantPlanning';
export * from './plantingInstances';
export * from './schemaMigrations';
export * from './validation';

import type { Garden } from './models';
import type {
  GardenDraft,
  GardenPublishRequest,
  GardenPublishResult,
  GardenRevertRequest,
  GardenWorkspace,
} from './gardenWorkspace';

export interface GardenRepository {
  discardDraft(userId: string): Promise<GardenDraft>;
  getGarden(userId: string): Promise<Garden | null>;
  getWorkspace(userId: string): Promise<GardenWorkspace>;
  publishDraft(request: GardenPublishRequest): Promise<GardenPublishResult>;
  revertToRevision(request: GardenRevertRequest): Promise<GardenPublishResult>;
  saveDraft(draft: GardenDraft): Promise<void>;
  saveGarden(garden: Garden): Promise<void>;
}
