import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { usePushRegistration } from './usePushRegistration';

const mocks = vi.hoisted(() => ({
  documents: [] as Array<Record<string, unknown>>,
  getPushInstallationId: vi.fn(() => Promise.resolve('current-installation')),
  onSnapshot: vi.fn(
    (
      _reference: unknown,
      onChange: (snapshot: {
        docs: Array<{ data(): Record<string, unknown> }>;
      }) => void,
    ) => {
      onChange({
        docs: mocks.documents.map((value) => ({ data: () => value })),
      });
      return () => undefined;
    },
  ),
  services: {
    environment: { runtimeMode: 'firebase' },
    mobileDeviceService: {
      getCapabilities: () => ({ platform: 'web' }),
    },
  },
}));

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(() => ({ path: 'users/user-a/pushTokens' })),
  onSnapshot: mocks.onSnapshot,
}));
vi.mock('../../infrastructure/firebase/app', () => ({
  getFirestoreClient: vi.fn(() => ({ app: 'firebase' })),
}));
vi.mock(
  '../../infrastructure/firebase/notifications/pushInstallationId',
  () => ({ getPushInstallationId: mocks.getPushInstallationId }),
);
vi.mock('./V2ServicesContext', () => ({
  useV2Services: () => mocks.services,
}));

describe('current-device push registration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.documents = [];
    Object.defineProperty(globalThis, 'Notification', {
      configurable: true,
      value: { permission: 'granted' },
    });
  });

  it('ignores active tokens that belong to another installation', async () => {
    mocks.documents = [
      {
        installationId: 'another-installation',
        lastSeenAtIso: '2026-07-09T12:00:00.000Z',
        platform: 'native-ios',
        status: 'active',
      },
    ];
    render(<Probe />);

    await waitFor(() =>
      expect(readState()).toEqual({
        permission: 'granted',
        registered: false,
        tokenUpdatedAtIso: null,
      }),
    );
  });

  it('reports only the current installation and platform as registered', async () => {
    mocks.documents = [
      {
        installationId: 'another-installation',
        lastSeenAtIso: '2026-07-09T13:00:00.000Z',
        platform: 'web',
        status: 'active',
      },
      {
        installationId: 'current-installation',
        lastSeenAtIso: '2026-07-09T12:00:00.000Z',
        platform: 'web',
        status: 'active',
      },
    ];
    render(<Probe />);

    await waitFor(() =>
      expect(readState()).toEqual({
        permission: 'granted',
        registered: true,
        tokenUpdatedAtIso: '2026-07-09T12:00:00.000Z',
      }),
    );
  });
});

function Probe() {
  const state = usePushRegistration('user-a');
  return <output data-testid="state">{JSON.stringify(state)}</output>;
}

function readState() {
  return JSON.parse(screen.getByTestId('state').textContent ?? '{}');
}
