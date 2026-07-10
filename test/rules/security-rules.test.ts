import { readFileSync } from 'node:fs';

import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  harvest,
  journal,
  member,
  plan,
  pushToken,
  seedWorkspace,
  task,
  userProfile,
} from './rulesFixtures';

const nowIso = '2026-07-09T12:00:00.000Z';
const projectId = 'demo-secret-faeries-rules';

describe('v2 security rules', () => {
  let testEnv: RulesTestEnvironment;

  beforeAll(async () => {
    testEnv = await initializeTestEnvironment({
      firestore: { rules: readFileSync('firestore.rules', 'utf8') },
      projectId,
      storage: { rules: readFileSync('storage.rules', 'utf8') },
    });
  });

  afterAll(async () => testEnv.cleanup());

  beforeEach(async () => {
    await testEnv.clearFirestore();
    await testEnv.clearStorage();
    await seedWorkspace(testEnv);
  });

  it('requires both membership claims and keeps profiles owner-only', async () => {
    const owner = member(testEnv, 'user-a');
    const other = member(testEnv, 'user-b');
    const missingClaim = testEnv.authenticatedContext('user-a', {
      gardenAccess: true,
    });
    const profile = userProfile('user-a');

    await assertSucceeds(owner.firestore().doc('users/user-a').set(profile));
    await assertSucceeds(owner.firestore().doc('users/user-a').get());
    await assertFails(other.firestore().doc('users/user-a').get());
    await assertFails(missingClaim.firestore().doc('users/user-a').get());
    await assertFails(
      owner
        .firestore()
        .doc('users/user-a')
        .set({ ...profile, schemaVersion: 1 }),
    );
    await assertFails(
      owner
        .firestore()
        .doc('users/user-a')
        .set({
          ...profile,
          notificationPreferences: {
            ...profile.notificationPreferences,
            dailyCheckTime: '25:00',
          },
        }),
    );
  });

  it('allows an owner to manage only well-formed push registrations', async () => {
    const owner = member(testEnv, 'user-a');
    const other = member(testEnv, 'user-b');
    const token = pushToken('token-a');
    const ref = owner.firestore().doc('users/user-a/pushTokens/token-a');
    await assertSucceeds(ref.set(token));
    await assertSucceeds(ref.get());
    await assertFails(
      other.firestore().doc('users/user-a/pushTokens/token-a').get(),
    );
    await assertFails(
      owner.firestore().doc('users/user-a/pushTokens/wrong-path').set(token),
    );
    await assertSucceeds(ref.delete());
  });

  it('shares the published plan while keeping each draft private and current', async () => {
    const owner = member(testEnv, 'user-a');
    const other = member(testEnv, 'user-b');
    const draft = {
      baseRevisionId: 'revision-initial',
      plan: plan(nowIso, 'Private draft'),
      updatedAtIso: nowIso,
      userId: 'user-a',
    };
    await assertSucceeds(
      owner.firestore().doc('gardenWorkspaces/main/plans/published').get(),
    );
    await assertSucceeds(
      other.firestore().doc('gardenWorkspaces/main/plans/published').get(),
    );
    await assertSucceeds(
      owner.firestore().doc('gardenWorkspaces/main/drafts/user-a').set(draft),
    );
    await assertSucceeds(
      owner.firestore().doc('gardenWorkspaces/main/drafts/user-a').get(),
    );
    await assertFails(
      other.firestore().doc('gardenWorkspaces/main/drafts/user-a').get(),
    );
    await assertFails(
      owner
        .firestore()
        .doc('gardenWorkspaces/main/drafts/user-a')
        .set({ ...draft, baseRevisionId: 'stale-revision' }),
    );
    await assertFails(
      other
        .firestore()
        .doc('gardenWorkspaces/main/drafts/user-a')
        .set({ ...draft, userId: 'user-b' }),
    );
  });

  it('rejects malformed nested schema-9 plan envelopes', async () => {
    const owner = member(testEnv, 'user-a');
    const validPlan = plan(nowIso, 'Private draft');
    const draftRef = owner
      .firestore()
      .doc('gardenWorkspaces/main/drafts/user-a');
    const writePlan = (nextPlan: Record<string, unknown>) =>
      draftRef.set({
        baseRevisionId: 'revision-initial',
        plan: nextPlan,
        updatedAtIso: nowIso,
        userId: 'user-a',
      });
    await assertFails(writePlan({ ...validPlan, injected: true }));
    await assertFails(
      writePlan({
        ...validPlan,
        plot: { ...validPlan.plot, widthFt: 0 },
      }),
    );
    await assertFails(
      writePlan({
        ...validPlan,
        plot: {
          ...validPlan.plot,
          climate: {
            ...validPlan.plot.climate,
            firstFrost: '13-40',
          },
        },
      }),
    );
    await assertFails(
      writePlan({
        ...validPlan,
        plot: {
          ...validPlan.plot,
          location: {
            ...validPlan.plot.location,
            coordinates: { latitude: 91, longitude: -83.0458 },
          },
        },
      }),
    );
    await assertFails(
      writePlan({
        ...validPlan,
        plantings: Array.from({ length: 513 }, () => null),
      }),
    );
  });

  it('reserves every shared-plan mutation for the trusted server boundary', async () => {
    const owner = member(testEnv, 'user-a');
    const firestore = owner.firestore();
    const publishedAtIso = '2026-07-09T12:05:00.000Z';
    const nextPlan = plan(publishedAtIso, 'Published safely');
    const revisionId = 'revision-next';
    const published = {
      plan: nextPlan,
      publishedAtIso,
      publishedByUserId: 'user-a',
      revisionId,
    };
    const privatePlan = plan(nowIso, 'Private layout');
    await firestore.doc('gardenWorkspaces/main/drafts/user-a').set({
      baseRevisionId: 'revision-initial',
      plan: privatePlan,
      updatedAtIso: nowIso,
      userId: 'user-a',
    });
    const batch = firestore.batch();
    batch.set(
      firestore.doc('gardenWorkspaces/main/plans/published'),
      published,
    );
    batch.set(firestore.doc(`gardenWorkspaces/main/revisions/${revisionId}`), {
      ...published,
      changeSummary: 'Safe publication',
    });
    batch.set(firestore.doc('gardenWorkspaces/main'), {
      id: 'main',
      operationsAutomation: {
        lastCompletedAtIso: nowIso,
        status: 'ready',
      },
      publishedRevisionId: revisionId,
      schemaVersion: 2,
      updatedAtIso: publishedAtIso,
    });
    batch.set(firestore.doc('gardenWorkspaces/main/drafts/user-a'), {
      baseRevisionId: revisionId,
      plan: {
        ...privatePlan,
        plot: {
          ...privatePlan.plot,
          climate: nextPlan.plot.climate,
          location: nextPlan.plot.location,
        },
        updatedAtIso: publishedAtIso,
      },
      updatedAtIso: publishedAtIso,
      userId: 'user-a',
    });
    await assertFails(batch.commit());
    const unchangedDraft = await assertSucceeds(
      firestore.doc('gardenWorkspaces/main/drafts/user-a').get(),
    );
    expect(unchangedDraft.data()?.plan.name).toBe('Private layout');
    const unchangedPublished = await assertSucceeds(
      firestore.doc('gardenWorkspaces/main/plans/published').get(),
    );
    expect(unchangedPublished.data()?.revisionId).toBe('revision-initial');
    const absentRevision = await assertSucceeds(
      firestore.doc(`gardenWorkspaces/main/revisions/${revisionId}`).get(),
    );
    expect(absentRevision.exists).toBe(false);
    await assertFails(
      firestore.doc(`gardenWorkspaces/main/revisions/${revisionId}`).update({
        changeSummary: 'Rewritten history',
      }),
    );
    await assertFails(
      firestore.doc(`gardenWorkspaces/main/revisions/${revisionId}`).delete(),
    );
    await assertFails(
      firestore.doc('gardenWorkspaces/main/plans/published').update({
        plan: plan('2026-07-09T12:10:00.000Z', 'Direct overwrite'),
        publishedAtIso: '2026-07-09T12:10:00.000Z',
        revisionId: 'missing-revision',
      }),
    );
    await assertFails(
      firestore.doc('gardenWorkspaces/main').update({
        operationsAutomation: { status: 'forged' },
      }),
    );
  });

  it('allows shared, validated journal, harvest, and task operations', async () => {
    const owner = member(testEnv, 'user-a');
    const other = member(testEnv, 'user-b');
    const journalRef = owner
      .firestore()
      .doc('gardenWorkspaces/main/journal/note-1');
    const harvestRef = owner
      .firestore()
      .doc('gardenWorkspaces/main/harvests/harvest-1');
    const taskRef = owner.firestore().doc('gardenWorkspaces/main/tasks/task-1');
    await assertSucceeds(journalRef.set(journal('note-1', 'user-a')));
    await assertSucceeds(harvestRef.set(harvest('harvest-1', 'user-a')));
    await assertSucceeds(taskRef.set(task('task-1')));
    await assertSucceeds(
      other.firestore().doc('gardenWorkspaces/main/journal/note-1').get(),
    );
    await assertSucceeds(
      other
        .firestore()
        .doc('gardenWorkspaces/main/journal/note-1')
        .update({ body: 'Partner update' }),
    );
    await assertFails(
      other
        .firestore()
        .doc('gardenWorkspaces/main/journal/spoofed')
        .set(journal('spoofed', 'user-a')),
    );
  });

  it('makes recommendations, balances, weather, alerts, and deliveries server-only', async () => {
    const owner = member(testEnv, 'user-a');
    const other = member(testEnv, 'user-b');
    const serverOnlyPaths = [
      'gardenWorkspaces/main/wateringRecommendations/crop-1',
      'gardenWorkspaces/main/waterBalances/crop-1',
      'gardenWorkspaces/main/weatherSnapshots/weather-1',
      'gardenWorkspaces/main/alerts/alert-1',
    ];
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await Promise.all(
        serverOnlyPaths.map((path) =>
          context.firestore().doc(path).set({ id: path }),
        ),
      );
      await context
        .firestore()
        .doc('users/user-a/notificationDeliveries/delivery-1')
        .set({ status: 'sent' });
    });

    for (const path of serverOnlyPaths) {
      await assertSucceeds(owner.firestore().doc(path).get());
      await assertFails(owner.firestore().doc(path).set({ attacked: true }));
      await assertFails(owner.firestore().doc(path).delete());
    }
    await assertSucceeds(
      owner
        .firestore()
        .doc('users/user-a/notificationDeliveries/delivery-1')
        .get(),
    );
    await assertFails(
      owner
        .firestore()
        .doc('users/user-a/notificationDeliveries/delivery-1')
        .set({ status: 'forged' }),
    );
    await assertFails(
      other
        .firestore()
        .doc('users/user-a/notificationDeliveries/delivery-1')
        .get(),
    );
  });

  it('keeps the catalog read-only and denies legacy or unknown paths', async () => {
    const owner = member(testEnv, 'user-a');
    await testEnv.withSecurityRulesDisabled((context) =>
      context.firestore().doc('catalog/tomato').set({ commonName: 'Tomato' }),
    );

    await assertSucceeds(owner.firestore().doc('catalog/tomato').get());
    await assertFails(
      owner.firestore().doc('catalog/tomato').set({ name: 'Attack' }),
    );
    await assertFails(owner.firestore().doc('gardens/user-a').get());
    await assertFails(owner.firestore().doc('gardenWorkspaces/other').get());
  });

  it('limits immutable journal photos to the path owner, image MIME, and size cap', async () => {
    const owner = member(testEnv, 'user-a');
    const other = member(testEnv, 'user-b');
    const ownerStorage = owner.storage(`gs://${projectId}.appspot.com`);
    const otherStorage = other.storage(`gs://${projectId}.appspot.com`);
    const path = 'gardenWorkspaces/main/journal/entry-1/user-a/photo.jpg';
    const metadata = {
      contentType: 'image/jpeg',
      customMetadata: { entryId: 'entry-1', userId: 'user-a' },
    };
    const ownerRef = ownerStorage.ref(path);

    await assertSucceeds(
      Promise.resolve(ownerRef.putString('image-bytes', 'raw', metadata)),
    );
    await assertSucceeds(
      Promise.resolve(otherStorage.ref(path).getDownloadURL()),
    );
    await assertFails(
      Promise.resolve(ownerRef.putString('replacement', 'raw', metadata)),
    );
    await assertFails(Promise.resolve(otherStorage.ref(path).delete()));
    await assertSucceeds(Promise.resolve(ownerRef.delete()));
    await assertFails(
      Promise.resolve(
        ownerStorage
          .ref('gardenWorkspaces/main/journal/entry-1/user-a/file.txt')
          .putString('text', 'raw', {
            ...metadata,
            contentType: 'text/plain',
          }),
      ),
    );
    await assertFails(
      Promise.resolve(
        ownerStorage
          .ref('gardenWorkspaces/main/journal/entry-1/user-a/large.jpg')
          .put(new Uint8Array(10 * 1024 * 1024 + 1), metadata),
      ),
    );
  }, 30_000);
});
