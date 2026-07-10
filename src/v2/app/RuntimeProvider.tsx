import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import type { ForegroundPushMessage } from '../../domain/notifications/NotificationService';
import { useV2Auth } from './AuthProvider';
import { useV2Services } from './V2ServicesContext';

interface RuntimeContextValue {
  dismissForegroundAlert(): void;
  foregroundAlert: ForegroundPushMessage | null;
  isOnline: boolean;
}

const RuntimeContext = createContext<RuntimeContextValue | null>(null);

export function V2RuntimeProvider({ children }: { children: ReactNode }) {
  const services = useV2Services();
  const auth = useV2Auth();
  const [isOnline, setOnline] = useState(
    typeof navigator === 'undefined' ? true : navigator.onLine,
  );
  const [foregroundAlert, setForegroundAlert] =
    useState<ForegroundPushMessage | null>(null);

  useEffect(() => {
    let active = true;
    void services.mobileDeviceService
      .getNetworkStatus()
      .then((status) => active && setOnline(status === 'online'))
      .catch((error) => {
        services.telemetryService.captureError(error, {
          context: 'v2_network_status_bootstrap',
        });
      });
    let unsubscribe: () => void = () => undefined;
    try {
      unsubscribe = services.mobileDeviceService.subscribeToNetworkStatus(
        (status) => setOnline(status === 'online'),
      );
    } catch (error) {
      services.telemetryService.captureError(error, {
        context: 'v2_network_status_subscription',
      });
    }
    return () => {
      active = false;
      unsubscribe();
    };
  }, [services.mobileDeviceService, services.telemetryService]);

  useEffect(() => {
    try {
      return services.notificationService.subscribeToForegroundMessages(
        setForegroundAlert,
      );
    } catch (error) {
      services.telemetryService.captureError(error, {
        context: 'v2_foreground_notification_subscription',
      });
      return undefined;
    }
  }, [services.notificationService, services.telemetryService]);

  useEffect(() => {
    const user = auth.user;
    const capability = services.mobileDeviceService.getCapabilities();
    if (
      !user ||
      capability.platform !== 'web' ||
      services.environment.runtimeMode !== 'firebase' ||
      !services.environment.messagingVapidKey ||
      typeof Notification === 'undefined' ||
      Notification.permission !== 'granted'
    ) {
      return;
    }
    void services.notificationService
      .registerWebPush(user.uid)
      .catch((error) => {
        services.telemetryService.captureError(error, {
          context: 'v2_push_installation_ownership_refresh',
        });
      });
  }, [
    auth.user,
    services.environment.messagingVapidKey,
    services.environment.runtimeMode,
    services.mobileDeviceService,
    services.notificationService,
    services.telemetryService,
  ]);

  useEffect(() => {
    const user = auth.user;
    if (!user) {
      void services.mobileDeviceService.clearSessionHint().catch((error) => {
        services.telemetryService.captureError(error, {
          context: 'v2_session_hint_clear',
        });
      });
      return;
    }
    const saveHint = () =>
      services.mobileDeviceService
        .saveSessionHint({
          displayName: user.displayName,
          email: user.email,
          lastRoute: `${window.location.pathname}${window.location.search}`,
          lastSignedInAtIso: new Date().toISOString(),
          userId: user.uid,
        })
        .catch((error) => {
          services.telemetryService.captureError(error, {
            context: 'v2_session_hint_save',
          });
        });
    void saveHint();
    const handlePagehide = () => void saveHint();
    window.addEventListener('pagehide', handlePagehide);
    return () => window.removeEventListener('pagehide', handlePagehide);
  }, [auth.user, services.mobileDeviceService, services.telemetryService]);

  const value = useMemo<RuntimeContextValue>(
    () => ({
      dismissForegroundAlert: () => setForegroundAlert(null),
      foregroundAlert,
      isOnline,
    }),
    [foregroundAlert, isOnline],
  );
  return (
    <RuntimeContext.Provider value={value}>{children}</RuntimeContext.Provider>
  );
}

export function useV2Runtime() {
  const value = useContext(RuntimeContext);
  if (!value) {
    throw new Error('useV2Runtime must be used inside V2RuntimeProvider.');
  }
  return value;
}
