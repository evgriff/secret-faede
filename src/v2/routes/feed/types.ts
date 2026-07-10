import type { ComponentType, ReactNode } from 'react';

import type {
  GardenIssue,
  HarvestRecord,
  JournalEntry,
  OperationTarget,
  PhotoAttachment,
} from '../../domain';
import type {
  WaterApplication,
  WateringRecommendation,
} from '../../domain/watering';

export type FeedEntryMode = 'harvest' | 'issue' | 'note' | 'photo';
export type FeedActivityType = FeedEntryMode | 'watering';
export type FeedIssueStatus = GardenIssue['status'];
export type FeedWateringStatus =
  | WaterApplication['outcome']
  | WateringRecommendation['status'];
export type FeedActivityStatus = FeedIssueStatus | FeedWateringStatus | null;

export interface FeedTargetOption {
  cropId: string | null;
  deepLink: string | null;
  target: OperationTarget;
  value: string;
}

export interface FeedLinkProps {
  children: ReactNode;
  className?: string;
  to: string;
}

export type FeedLinkComponent = ComponentType<FeedLinkProps>;

export type FeedWateringActivity =
  | {
      application: WaterApplication;
      cropName: string;
      kind: 'application';
      target: FeedTargetOption;
    }
  | {
      kind: 'recommendation';
      recommendation: WateringRecommendation;
    };

export interface FeedActivityItem {
  body: string;
  createdByUserId: string | null;
  id: string;
  issue: GardenIssue | null;
  meta: string[];
  occurredAt: string;
  photos: PhotoAttachment[];
  sortAt: string;
  status: FeedActivityStatus;
  targetDeepLink: string | null;
  targetLabel: string;
  targetValue: string;
  title: string;
  type: FeedActivityType;
  watering: FeedWateringActivity | null;
}

export interface FeedSummary {
  harvests: number;
  memories: number;
  openIssues: number;
  photos: number;
  watering: number;
}

export interface FeedFiltersValue {
  query: string;
  status: 'all' | Exclude<FeedActivityStatus, null>;
  targetValue: string;
  type: 'all' | FeedActivityType;
}

export type FeedCreateEntryInput =
  | {
      body: string;
      files: readonly File[];
      kind: 'issue';
      issue: {
        category: GardenIssue['category'];
        severity: GardenIssue['severity'];
        status: GardenIssue['status'];
      };
      occurredOn: string;
      target: OperationTarget;
      title: string;
    }
  | {
      body: string;
      files: readonly File[];
      kind: 'note' | 'photo';
      occurredOn: string;
      target: OperationTarget;
      title: string;
    }
  | {
      amount: number | null;
      cropId: string;
      freeformAmount: string;
      kind: 'harvest';
      notes: string;
      occurredOn: string;
      plantingGroupId: string;
      unit: HarvestRecord['unit'];
    };

export type FeedCreateResult = 'queued' | 'saved';

export type FeedCorrectWateringInput =
  | {
      amount: { unit: 'gallons' | 'inches'; value: number };
      applicationId: string;
      method: WaterApplication['method'];
      occurredOn: string;
      outcome: 'applied' | 'partial';
      skipReason: null;
    }
  | {
      amount: null;
      applicationId: string;
      method: WaterApplication['method'];
      occurredOn: string;
      outcome: 'skipped';
      skipReason: string;
    };

export interface FeedPageProps {
  LinkComponent: FeedLinkComponent;
  currentUserId: string;
  errorMessage?: string | null;
  getPhotoUrl?(photo: PhotoAttachment): string | null;
  harvests: readonly HarvestRecord[];
  isOnline: boolean;
  journalEntries: readonly (GardenIssue | JournalEntry)[];
  loadState?: 'error' | 'loading' | 'ready';
  onCreateEntry(input: FeedCreateEntryInput): Promise<FeedCreateResult>;
  onCorrectWatering?(
    input: FeedCorrectWateringInput,
  ): Promise<FeedCreateResult>;
  onRetry?(): Promise<void> | void;
  onUpdateIssue?(issue: GardenIssue): Promise<FeedCreateResult>;
  targets: readonly FeedTargetOption[];
  timezone: string;
  today: string;
  wateringActivity?: readonly FeedWateringActivity[];
}
