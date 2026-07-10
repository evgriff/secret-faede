import { readFileSync } from 'node:fs';

import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { member, seedWorkspace, waterApplication } from './rulesFixtures';

const projectId = 'demo-secret-faeries-water-rules';

describe('water-application security rules', () => {
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

  it('requires the authenticated recorder and accepts a partial application', async () => {
    const owner = member(testEnv, 'user-a');
    const other = member(testEnv, 'user-b');
    const appliedRef = owner
      .firestore()
      .doc('gardenWorkspaces/main/waterApplications/water-1');
    const partialRef = owner
      .firestore()
      .doc('gardenWorkspaces/main/waterApplications/water-partial');

    await assertSucceeds(appliedRef.set(waterApplication('water-1', 1)));
    await assertSucceeds(
      partialRef.set({
        ...waterApplication('water-partial', 1),
        outcome: 'partial',
      }),
    );
    await assertSucceeds(
      other
        .firestore()
        .doc('gardenWorkspaces/main/waterApplications/water-partial')
        .get(),
    );
    await assertFails(
      owner
        .firestore()
        .doc('gardenWorkspaces/main/waterApplications/spoofed-recorder')
        .set(waterApplication('spoofed-recorder', 1, 'user-b')),
    );
  });

  it('allows revision-plus-one corrections but denies actor, crop, and revision spoofing', async () => {
    const owner = member(testEnv, 'user-a');
    const ref = owner
      .firestore()
      .doc('gardenWorkspaces/main/waterApplications/water-1');
    await assertSucceeds(ref.set(waterApplication('water-1', 1)));

    const correction = {
      ...waterApplication('water-1', 2),
      amount: { depthInches: 0.2, unit: 'inches' },
      outcome: 'partial',
    };
    await assertSucceeds(ref.set(correction));
    await assertFails(
      ref.set({ ...correction, recordedByUserId: 'user-b', revision: 3 }),
    );
    await assertFails(
      ref.set({ ...correction, cropGroupId: 'different-crop', revision: 3 }),
    );
    await assertFails(ref.set({ ...correction, revision: 2 }));
    await assertFails(ref.set({ ...correction, revision: 4 }));
    await assertFails(ref.delete());
  });
});
