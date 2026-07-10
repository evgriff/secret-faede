import { readFileSync } from 'node:fs';

import {
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import type { Firestore } from 'firebase/firestore';

import { FirebaseGardenRepository } from '../../src/v2/data/FirebaseGardenRepository';
import { FirebaseUserProfileRepository } from '../../src/v2/data/FirebaseUserProfileRepository';
import type { WorkspaceSubscription } from '../../src/v2/data/GardenRepository';
import type { WorkspaceMutationGateway } from '../../src/v2/data/WorkspaceMutationGateway';
import type { GardenWorkspaceView, UserProfile } from '../../src/v2/domain';
import { member, plan, seedWorkspace, userProfile } from './rulesFixtures';

const now = new Date('2026-07-09T12:15:00.000Z');
const projectId = 'demo-secret-faeries-rules';

describe('v2 Firebase repositories against security rules', () => {
  let testEnv: RulesTestEnvironment;

  beforeAll(async () => {
    testEnv = await initializeTestEnvironment({
      firestore: { rules: readFileSync('firestore.rules', 'utf8') },
      projectId,
    });
  });

  afterAll(async () => testEnv.cleanup());

  beforeEach(async () => {
    await testEnv.clearFirestore();
    await seedWorkspace(testEnv);
  });

  it('loads, subscribes, drafts, publishes, and saves a profile through active adapters', async () => {
    const userId = 'user-a';
    const compatDb = member(testEnv, userId).firestore() as unknown as {
      _delegate: Firestore;
    };
    const mutations: WorkspaceMutationGateway = {
      publishDraft: async (input) => {
        const committedAtIso = now.toISOString();
        await testEnv.withSecurityRulesDisabled(async (context) => {
          const firestore = context.firestore();
          const metadataRef = firestore.doc('gardenWorkspaces/main');
          const draftRef = firestore.doc(
            `gardenWorkspaces/main/drafts/${input.userId}`,
          );
          const [metadataSnapshot, draftSnapshot] = await Promise.all([
            metadataRef.get(),
            draftRef.get(),
          ]);
          const metadata = metadataSnapshot.data();
          const draft = draftSnapshot.data();
          if (
            metadata?.publishedRevisionId !== input.expectedRevisionId ||
            !draft
          ) {
            throw new Error('The trusted test boundary received stale input.');
          }
          const revisionId = 'revision-from-trusted-boundary';
          const published = {
            plan: { ...draft.plan, updatedAtIso: committedAtIso },
            publishedAtIso: committedAtIso,
            publishedByUserId: input.userId,
            revisionId,
          };
          const batch = firestore.batch();
          batch.set(
            firestore.doc('gardenWorkspaces/main/plans/published'),
            published,
          );
          batch.set(
            firestore.doc(`gardenWorkspaces/main/revisions/${revisionId}`),
            { ...published, changeSummary: input.changeSummary },
          );
          batch.update(metadataRef, {
            publishedRevisionId: revisionId,
            updatedAtIso: committedAtIso,
          });
          batch.delete(draftRef);
          await batch.commit();
        });
        return { committedAtIso, status: 'committed' };
      },
      publishSharedSettings: async () => {
        throw new Error('Not used in this repository integration test.');
      },
      revertPublished: async () => {
        throw new Error('Not used in this repository integration test.');
      },
    };
    const gardenRepository = new FirebaseGardenRepository({
      db: compatDb._delegate,
      isOnline: () => true,
      mutations,
      now: () => now,
    });
    const profileRepository = new FirebaseUserProfileRepository(
      compatDb._delegate,
      () => true,
      () => now,
    );

    const initial = await gardenRepository.getWorkspace(userId);
    expect(initial.published.revisionId).toBe('revision-initial');

    const draftPlan = {
      ...plan(now.toISOString(), 'Adapter round-trip draft'),
      createdAtIso: initial.published.plan.createdAtIso,
    };
    await expect(
      gardenRepository.saveDraft({
        expectedRevisionId: initial.published.revisionId,
        plan: draftPlan,
        userId,
      }),
    ).resolves.toMatchObject({ status: 'committed' });

    const observedDraft = await observeOnce<GardenWorkspaceView>((next, fail) =>
      gardenRepository.subscribe(userId, next, fail),
    );
    expect(observedDraft.draft?.plan.name).toBe('Adapter round-trip draft');

    await expect(
      gardenRepository.publishDraft({
        changeSummary: 'Repository emulator round-trip',
        expectedRevisionId: initial.published.revisionId,
        userId,
      }),
    ).resolves.toMatchObject({ status: 'committed' });
    const published = await gardenRepository.getWorkspace(userId);
    expect(published.draft).toBeNull();
    expect(published.published.plan.name).toBe('Adapter round-trip draft');
    expect(published.published.revisionId).not.toBe('revision-initial');

    const profile = userProfile(userId);
    await expect(profileRepository.saveProfile(profile)).resolves.toMatchObject(
      { status: 'committed' },
    );
    await expect(profileRepository.getProfile(userId)).resolves.toEqual(
      profile,
    );
    const observedProfile = await observeOnce<UserProfile>((next, fail) =>
      profileRepository.subscribe(userId, next, fail),
    );
    expect(observedProfile.userId).toBe(userId);
  });
});

async function observeOnce<T>(
  subscribe: (
    next: (value: T) => void,
    fail: (error: Error) => void,
  ) => WorkspaceSubscription,
) {
  const holder: { subscription: WorkspaceSubscription | null } = {
    subscription: null,
  };
  try {
    return await new Promise<T>((resolve, reject) => {
      holder.subscription = subscribe(resolve, reject);
    });
  } finally {
    holder.subscription?.unsubscribe();
  }
}
