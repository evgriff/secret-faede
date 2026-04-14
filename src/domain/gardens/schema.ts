import type { GardenRole } from './types';

export type FirestoreTimestampString = string;

export interface UserDocument {
  createdAt: FirestoreTimestampString;
  displayName: string | null;
  email: string;
  lastGardenId: string | null;
  updatedAt: FirestoreTimestampString;
}

export interface GardenDocument {
  createdAt: FirestoreTimestampString;
  dimensions: {
    height: number;
    unit: 'ft';
    width: number;
  };
  name: string;
  ownerUid: string;
  slug: string;
  timezone: string;
  updatedAt: FirestoreTimestampString;
}

export interface GardenMemberDocument {
  createdAt: FirestoreTimestampString;
  role: GardenRole;
  uid: string;
}

export interface PlotDocument {
  createdAt: FirestoreTimestampString;
  height: number;
  name: string;
  rotation: number;
  updatedAt: FirestoreTimestampString;
  width: number;
  x: number;
  y: number;
}

export interface PlantingDocument {
  createdAt: FirestoreTimestampString;
  expectedGerminationEnd: FirestoreTimestampString | null;
  expectedGerminationStart: FirestoreTimestampString | null;
  notes: string | null;
  plantId: string;
  plantedOn: FirestoreTimestampString;
  plotId: string;
  spacingCm: number | null;
  status: 'planned' | 'planted' | 'harvested' | 'removed';
  updatedAt: FirestoreTimestampString;
  wateringCadenceDays: number | null;
}

export const firestoreCollections = {
  gardens: 'gardens',
  members: 'members',
  plantings: 'plantings',
  plots: 'plots',
  users: 'users',
} as const;
