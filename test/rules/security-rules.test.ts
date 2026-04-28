import { readFileSync } from 'node:fs';

import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';

describe('security rules', () => {
  let testEnv: RulesTestEnvironment;

  beforeAll(async () => {
    testEnv = await initializeTestEnvironment({
      firestore: {
        rules: readFileSync('firestore.rules', 'utf8'),
      },
      projectId: 'demo-secret-faeries-rules',
      storage: {
        rules: readFileSync('storage.rules', 'utf8'),
      },
    });
  });

  afterAll(async () => {
    await testEnv.cleanup();
  });

  beforeEach(async () => {
    await testEnv.clearFirestore();
    await testEnv.clearStorage();
  });

  it('allows only membership-claim garden members to read and write their own garden data', async () => {
    const owner = testEnv.authenticatedContext('user-a', {
      email: 'grower@example.com',
      gardenAccess: true,
      secretFaeriesMember: true,
    });
    const noClaim = testEnv.authenticatedContext('user-a', {
      email: 'grower@example.com',
    });
    const otherUser = testEnv.authenticatedContext('user-b', {
      email: 'other@example.com',
      gardenAccess: true,
      secretFaeriesMember: true,
    });
    const legacyClaimOnly = testEnv.authenticatedContext('user-a', {
      email: 'grower@example.com',
      gardenAccess: true,
    });

    await assertSucceeds(
      owner.firestore().doc('gardens/user-a').set({
        id: 'user-a',
        name: 'Home garden',
        userId: 'user-a',
      }),
    );
    await assertSucceeds(
      owner.firestore().doc('gardens/user-a/plantings/tomato').set({
        id: 'tomato',
        label: 'Tomato',
      }),
    );
    await assertFails(noClaim.firestore().doc('gardens/user-a').get());
    await assertFails(legacyClaimOnly.firestore().doc('gardens/user-a').get());
    await assertFails(otherUser.firestore().doc('gardens/user-a').get());
    await assertFails(
      owner.firestore().doc('gardens/user-a/private/debug').set({ ok: true }),
    );
  });

  it('keeps catalog read-only for garden members', async () => {
    const owner = testEnv.authenticatedContext('user-a', {
      gardenAccess: true,
      secretFaeriesMember: true,
    });

    await testEnv.withSecurityRulesDisabled(async (context) => {
      await context.firestore().doc('catalog/tomato').set({
        commonName: 'Tomato',
      });
    });

    await assertSucceeds(owner.firestore().doc('catalog/tomato').get());
    await assertFails(
      owner.firestore().doc('catalog/tomato').set({
        commonName: 'Changed',
      }),
    );
  });

  it('allows members to publish revisions while keeping drafts per owner', async () => {
    const owner = testEnv.authenticatedContext('user-a', {
      gardenAccess: true,
      secretFaeriesMember: true,
    });
    const otherUser = testEnv.authenticatedContext('user-b', {
      gardenAccess: true,
      secretFaeriesMember: true,
    });
    const noClaim = testEnv.authenticatedContext('user-a');

    await assertSucceeds(
      owner.firestore().doc('gardenWorkspaces/main').set({
        id: 'revision-1',
        name: 'Published garden',
      }),
    );
    await assertSucceeds(
      owner.firestore().doc('gardenWorkspaces/main/drafts/user-a').set({
        baseRevisionId: 'revision-1',
      }),
    );
    await assertSucceeds(
      otherUser.firestore().doc('gardenWorkspaces/main/journal/issue-1').set({
        id: 'issue-1',
        title: 'Slug pressure',
      }),
    );
    await assertSucceeds(
      otherUser
        .firestore()
        .doc('gardenWorkspaces/main/revisions/revision-1')
        .get(),
    );
    await assertSucceeds(
      owner.firestore().doc('gardenWorkspaces/main/journal/issue-1').get(),
    );
    await assertFails(
      otherUser.firestore().doc('gardenWorkspaces/main/drafts/user-a').get(),
    );
    await assertFails(
      noClaim.firestore().doc('gardenWorkspaces/main/journal/issue-1').get(),
    );
    await assertFails(noClaim.firestore().doc('gardenWorkspaces/main').get());
  });

  it('limits journal photo storage to owner image uploads', async () => {
    const owner = testEnv.authenticatedContext('user-a', {
      gardenAccess: true,
      secretFaeriesMember: true,
    });
    const otherUser = testEnv.authenticatedContext('user-b', {
      gardenAccess: true,
      secretFaeriesMember: true,
    });
    const noClaim = testEnv.authenticatedContext('user-a');
    const ownerStorage = owner.storage(
      'gs://demo-secret-faeries-rules.appspot.com',
    );
    const ownerRef = ownerStorage.ref('users/user-a/journal/entry/photo.jpg');
    const sharedRef = ownerStorage.ref(
      'gardenWorkspaces/main/journal/entry/photo.jpg',
    );

    await assertSucceeds(
      Promise.resolve(
        ownerRef.putString('image-bytes', 'raw', {
          contentType: 'image/jpeg',
        }),
      ),
    );
    await assertFails(
      Promise.resolve(
        ownerStorage
          .ref('users/user-a/journal/entry/file.txt')
          .putString('text', 'raw', {
            contentType: 'text/plain',
          }),
      ),
    );
    await assertFails(
      Promise.resolve(
        noClaim
          .storage('gs://demo-secret-faeries-rules.appspot.com')
          .ref('users/user-a/journal/entry/photo-2.jpg')
          .putString('image-bytes', 'raw', {
            contentType: 'image/jpeg',
          }),
      ),
    );
    await assertFails(
      Promise.resolve(
        otherUser
          .storage('gs://demo-secret-faeries-rules.appspot.com')
          .ref('users/user-a/journal/entry/photo-3.jpg')
          .putString('image-bytes', 'raw', {
            contentType: 'image/jpeg',
          }),
      ),
    );
    await assertSucceeds(
      Promise.resolve(
        sharedRef.putString('image-bytes', 'raw', {
          contentType: 'image/jpeg',
        }),
      ),
    );
    await assertSucceeds(
      Promise.resolve(
        otherUser
          .storage('gs://demo-secret-faeries-rules.appspot.com')
          .ref('gardenWorkspaces/main/journal/entry/photo.jpg')
          .getDownloadURL(),
      ),
    );
    await assertFails(
      Promise.resolve(
        noClaim
          .storage('gs://demo-secret-faeries-rules.appspot.com')
          .ref('gardenWorkspaces/main/journal/entry/photo.jpg')
          .getDownloadURL(),
      ),
    );
  });
});
