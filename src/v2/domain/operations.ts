import type { IsoDateString, LocalDateString } from './plan';
import type {
  WaterApplication,
  WateringRecommendation,
} from './watering/types';

export type OperationTargetKind = 'garden' | 'plantingGroup' | 'structure';

export interface OperationTarget {
  id: string | null;
  kind: OperationTargetKind;
  label: string;
}

export type TaskKind =
  | 'feed'
  | 'fertilize'
  | 'harvest'
  | 'inspect'
  | 'mulch'
  | 'plant'
  | 'prune'
  | 'support'
  | 'thin'
  | 'water'
  | 'weed';

export interface GardenTask {
  completedAtIso: IsoDateString | null;
  createdAtIso: IsoDateString;
  dueOn: LocalDateString;
  id: string;
  kind: TaskKind;
  notes: string;
  priority: 'high' | 'low' | 'medium';
  reason: string;
  sourceId: string | null;
  status: 'deferred' | 'done' | 'open' | 'snoozed';
  target: OperationTarget;
  title: string;
  updatedAtIso: IsoDateString;
}

export interface PhotoAttachment {
  contentType: string;
  fileName: string;
  height: number | null;
  id: string;
  sizeBytes: number;
  storagePath: string;
  uploadedAtIso: IsoDateString;
  width: number | null;
}

export interface JournalEntry {
  body: string;
  createdAtIso: IsoDateString;
  createdByUserId: string;
  id: string;
  occurredOn: LocalDateString;
  photos: PhotoAttachment[];
  target: OperationTarget;
  title: string;
  type: 'issue' | 'note' | 'photo';
}

export interface GardenIssue extends JournalEntry {
  category:
    | 'disease'
    | 'general'
    | 'irrigation'
    | 'nutrient'
    | 'pest'
    | 'weatherDamage';
  resolvedAtIso: IsoDateString | null;
  severity: 'high' | 'low' | 'medium';
  status: 'inProgress' | 'open' | 'resolved';
  type: 'issue';
}

export interface HarvestRecord {
  amount: number | null;
  createdAtIso: IsoDateString;
  createdByUserId: string;
  cropId: string;
  id: string;
  notes: string;
  occurredOn: LocalDateString;
  plantingGroupId: string;
  unit: 'bunch' | 'count' | 'freeform' | 'lb' | 'oz';
}

export interface GardenOperationsSnapshot {
  harvests: HarvestRecord[];
  journal: Array<GardenIssue | JournalEntry>;
  tasks: GardenTask[];
  waterApplications: WaterApplication[];
  wateringRecommendations: WateringRecommendation[];
}
