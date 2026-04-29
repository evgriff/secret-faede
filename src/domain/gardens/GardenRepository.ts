export * from './models';
export * from './plantMaturity';
export * from './plantingAreaFit';
export * from './plantingGeometry';
export * from './plantingEvents';
export * from './plantPlanning';
export * from './plantingInstances';
export * from './schemaMigrations';
export * from './sharedOperations';
export * from './supportNeeds';
export * from './validation';

import type { Garden } from './models';
import type { GardenActivityActor } from './sharedOperations';
import type {
  GardenDraft,
  GardenPublishRequest,
  GardenPublishResult,
  GardenRevertRequest,
  GardenWorkspace,
} from './gardenWorkspace';

export interface SaveSharedGardenOperationsRequest {
  actor: GardenActivityActor;
  baseGarden: Garden;
  updatedGarden: Garden;
  userId: string;
}

export type GardenWorkspaceListener = (workspace: GardenWorkspace) => void;
export type GardenWorkspaceUnsubscribe = () => void;

export interface GardenRepository {
  discardDraft(userId: string): Promise<GardenDraft>;
  getGarden(userId: string): Promise<Garden | null>;
  getWorkspace(userId: string): Promise<GardenWorkspace>;
  publishDraft(request: GardenPublishRequest): Promise<GardenPublishResult>;
  revertToRevision(request: GardenRevertRequest): Promise<GardenPublishResult>;
  saveDraft(draft: GardenDraft): Promise<void>;
  saveGarden(garden: Garden): Promise<void>;
  saveSharedOperations(
    request: SaveSharedGardenOperationsRequest,
  ): Promise<Garden>;
  subscribeWorkspace(
    userId: string,
    listener: GardenWorkspaceListener,
  ): GardenWorkspaceUnsubscribe;
}
