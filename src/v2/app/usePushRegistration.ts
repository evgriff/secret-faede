import { useEffect, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';

import { getFirestoreClient } from '../../infrastructure/firebase/app';
import { getPushInstallationId } from '../../infrastructure/firebase/notifications/pushInstallationId';
import type { PushRegistrationState } from '../domain';
import { useV2Services } from './V2ServicesContext';

export function usePushRegistration(userId: string | null) {
  const services = useV2Services();
  const [state, setState] = useState<PushRegistrationState>(() =>
    browserPermission(false, null),
  );

  useEffect(() => {
    if (!userId || services.environment.runtimeMode !== 'firebase') {
      setState({
        permission: 'unsupported',
        registered: false,
        tokenUpdatedAtIso: null,
      });
      return;
    }
    const db = getFirestoreClient(services.environment);
    let active = true;
    let unsubscribe: () => void = () => undefined;
    void getPushInstallationId()
      .then((installationId) => {
        if (!active) return;
        const currentPlatform = pushPlatform(
          services.mobileDeviceService.getCapabilities().platform,
        );
        unsubscribe = onSnapshot(
          collection(db, 'users', userId, 'pushTokens'),
          (snapshot) => {
            const currentInstallation = snapshot.docs
              .map((entry) => entry.data())
              .filter(
                (value) =>
                  value.status === 'active' &&
                  value.installationId === installationId &&
                  value.platform === currentPlatform,
              );
            const latest =
              currentInstallation
                .map((value) =>
                  typeof value.lastSeenAtIso === 'string'
                    ? value.lastSeenAtIso
                    : null,
                )
                .filter((value): value is string => Boolean(value))
                .sort()
                .at(-1) ?? null;
            setState(
              currentPlatform.startsWith('native-') &&
                currentInstallation.length > 0
                ? {
                    permission: 'granted',
                    registered: true,
                    tokenUpdatedAtIso: latest,
                  }
                : browserPermission(currentInstallation.length > 0, latest),
            );
          },
          () => setState(browserPermission(false, null)),
        );
      })
      .catch(() => setState(browserPermission(false, null)));
    return () => {
      active = false;
      unsubscribe();
    };
  }, [services.environment, services.mobileDeviceService, userId]);

  return state;
}

function pushPlatform(platform: 'android' | 'ios' | 'web') {
  return platform === 'web' ? platform : `native-${platform}`;
}

function browserPermission(
  registered: boolean,
  tokenUpdatedAtIso: string | null,
): PushRegistrationState {
  const permission =
    typeof Notification === 'undefined'
      ? 'unsupported'
      : Notification.permission === 'default'
        ? 'prompt'
        : Notification.permission;
  return { permission, registered, tokenUpdatedAtIso };
}
