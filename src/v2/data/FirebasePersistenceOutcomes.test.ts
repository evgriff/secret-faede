import type { Firestore } from 'firebase/firestore';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { HarvestRecord, UserProfile } from '../domain';
import { FirebaseGardenRepository } from './FirebaseGardenRepository';
import { FirebaseUserProfileRepository } from './FirebaseUserProfileRepository';
import type { WorkspaceMutationGateway } from './WorkspaceMutationGateway';

const firestore = vi.hoisted(() => ({
  collection: vi.fn(),
  deleteDoc: vi.fn(),
  doc: vi.fn((_db: unknown, ...segments: string[]) => ({ segments })),
  getDoc: vi.fn(),
  getDocs: vi.fn(),
  limit: vi.fn(),
  onSnapshot: vi.fn(),
  orderBy: vi.fn(),
  query: vi.fn(),
  runTransaction: vi.fn(),
  setDoc: vi.fn(),
}));

vi.mock('firebase/firestore', () => firestore);

describe('Firebase persistence outcomes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('reports an operation committed only after Firestore accepts it', async () => {
    firestore.setDoc.mockResolvedValue(undefined);
    const repository = gardenRepository();

    await expect(repository.recordHarvest(harvest())).resolves.toEqual({
      committedAtIso: '2026-07-09T12:00:00.000Z',
      status: 'committed',
    });
    expect(firestore.setDoc).toHaveBeenCalledOnce();
  });

  it('surfaces an offline Firestore operation failure instead of claiming it queued', async () => {
    firestore.setDoc.mockRejectedValue(new Error('client is offline'));

    await expect(gardenRepository().recordHarvest(harvest())).rejects.toThrow(
      /offline/i,
    );
  });

  it('reports a profile committed only after Firestore accepts it', async () => {
    firestore.setDoc.mockResolvedValue(undefined);
    const repository = new FirebaseUserProfileRepository(
      {} as Firestore,
      () => false,
      () => new Date('2026-07-09T12:00:00.000Z'),
    );

    await expect(repository.saveProfile(profile())).resolves.toEqual({
      committedAtIso: '2026-07-09T12:00:00.000Z',
      status: 'committed',
    });
  });

  it('surfaces a failed profile write without returning a queued outcome', async () => {
    firestore.setDoc.mockRejectedValue(new Error('permission denied'));
    const repository = new FirebaseUserProfileRepository({} as Firestore);

    await expect(repository.saveProfile(profile())).rejects.toThrow(
      /permission denied/i,
    );
  });
});

function gardenRepository() {
  const mutations: WorkspaceMutationGateway = {
    publishDraft: async () => {
      throw new Error('Not used in this test.');
    },
    publishSharedSettings: async () => {
      throw new Error('Not used in this test.');
    },
    revertPublished: async () => {
      throw new Error('Not used in this test.');
    },
  };
  return new FirebaseGardenRepository({
    db: {} as Firestore,
    isOnline: () => false,
    mutations,
    now: () => new Date('2026-07-09T12:00:00.000Z'),
  });
}

function harvest(): HarvestRecord {
  return {
    amount: 2,
    createdAtIso: '2026-07-09T11:00:00.000Z',
    createdByUserId: 'user-1',
    cropId: 'tomato',
    id: 'harvest-1',
    notes: '',
    occurredOn: '2026-07-09',
    plantingGroupId: 'tomato-group',
    unit: 'lb',
  };
}

function profile(): UserProfile {
  return {
    displayName: 'Primary Gardener',
    email: 'primary@example.com',
    notificationPreferences: {
      alertKinds: {
        frost: true,
        heat: true,
        severeWeather: true,
        taskDue: true,
        watering: true,
      },
      dailyCheckTime: '07:00',
      minimumWateringDeficitInches: 0.25,
      pushEnabled: false,
      quietHours: { end: '07:00', start: '21:00' },
    },
    schemaVersion: 2,
    timezone: 'America/Detroit',
    updatedAtIso: '2026-07-09T12:00:00.000Z',
    userId: 'user-1',
  };
}
