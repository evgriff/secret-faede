import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AppEnvironment } from '../../shared/config/env';
import {
  CallableFirebaseWorkspaceMutationGateway,
  readCommitOutcome,
} from './FirebaseWorkspaceMutationGateway';
import { createEmptyGardenPlan } from './defaultPlan';

const mocks = vi.hoisted(() => ({
  callables: new Map<string, ReturnType<typeof vi.fn>>(),
  functions: { app: 'firebase' },
  httpsCallable: vi.fn((_functions: unknown, name: string) => {
    const callable = vi.fn();
    mocks.callables.set(name, callable);
    return callable;
  }),
}));

vi.mock('firebase/functions', () => ({ httpsCallable: mocks.httpsCallable }));
vi.mock('../../infrastructure/firebase/app', () => ({
  getFirebaseFunctionsClient: vi.fn(() => mocks.functions),
}));

const environment = {
  runtimeMode: 'firebase',
} as AppEnvironment;

describe('callable Firebase workspace mutation gateway', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.callables.clear();
  });

  it('publishes without trusting a client-supplied actor id', async () => {
    const gateway = new CallableFirebaseWorkspaceMutationGateway(environment);
    mocks.callables.get('publishGardenDraftV2')?.mockResolvedValue({
      data: {
        committedAtIso: '2026-07-09T12:00:00.000Z',
        revisionId: 'revision-2',
        status: 'committed',
      },
    });

    await expect(
      gateway.publishDraft({
        changeSummary: 'Published safely',
        expectedRevisionId: 'revision-1',
        userId: 'untrusted-client-value',
      }),
    ).resolves.toEqual({
      committedAtIso: '2026-07-09T12:00:00.000Z',
      status: 'committed',
    });
    expect(mocks.callables.get('publishGardenDraftV2')).toHaveBeenCalledWith({
      changeSummary: 'Published safely',
      expectedRevisionId: 'revision-1',
    });
  });

  it('sends only the required revert and shared-settings fields', async () => {
    const gateway = new CallableFirebaseWorkspaceMutationGateway(environment);
    const committed = {
      data: {
        committedAtIso: '2026-07-09T12:00:00.000Z',
        status: 'committed',
      },
    };
    mocks.callables.get('revertGardenPlanV2')?.mockResolvedValue(committed);
    mocks.callables
      .get('publishGardenSettingsV2')
      ?.mockResolvedValue(committed);
    const plan = createEmptyGardenPlan(new Date('2026-07-09T12:00:00.000Z'));

    await gateway.revertPublished({
      expectedRevisionId: 'revision-1',
      revisionId: 'revision-old',
      userId: 'user-a',
    });
    await gateway.publishSharedSettings({
      expectedRevisionId: 'revision-1',
      plan,
      userId: 'user-a',
    });

    expect(mocks.callables.get('revertGardenPlanV2')).toHaveBeenCalledWith({
      expectedRevisionId: 'revision-1',
      revisionId: 'revision-old',
    });
    expect(mocks.callables.get('publishGardenSettingsV2')).toHaveBeenCalledWith(
      { expectedRevisionId: 'revision-1', plan },
    );
  });

  it('validates committed and conflict response envelopes', () => {
    expect(
      readCommitOutcome({
        actualRevisionId: 'revision-2',
        expectedRevisionId: 'revision-1',
        status: 'conflict',
      }),
    ).toEqual({
      actualRevisionId: 'revision-2',
      expectedRevisionId: 'revision-1',
      status: 'conflict',
    });
    expect(() => readCommitOutcome({ status: 'committed' })).toThrow(
      /invalid|unsupported/i,
    );
  });
});
