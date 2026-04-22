import { createContext, useContext, useEffect, type ReactNode } from 'react';

import { AuthProvider, useAuth } from '../features/auth/auth-context';
import type { AppServices } from '../infrastructure/runtime/services';

const ServicesContext = createContext<AppServices | null>(null);

export function AppProviders({
  children,
  services,
}: {
  children: ReactNode;
  services: AppServices;
}) {
  return (
    <ServicesContext.Provider value={services}>
      <WindowTelemetryBridge />
      <AuthProvider>
        <MobileSessionBridge>
          <ForegroundPushBridge>{children}</ForegroundPushBridge>
        </MobileSessionBridge>
      </AuthProvider>
    </ServicesContext.Provider>
  );
}

function WindowTelemetryBridge() {
  const { telemetryService } = useServices();

  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      telemetryService.captureError(event.error ?? event.message, {
        context: 'window_error',
        message: event.message,
      });
    };
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      telemetryService.captureError(event.reason, {
        context: 'unhandled_rejection',
      });
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener(
        'unhandledrejection',
        handleUnhandledRejection,
      );
    };
  }, [telemetryService]);

  return null;
}

export function useServices() {
  const context = useContext(ServicesContext);

  if (!context) {
    throw new Error('useServices must be used inside AppProviders.');
  }

  return context;
}

function ForegroundPushBridge({ children }: { children: ReactNode }) {
  const { notificationService } = useServices();

  useEffect(
    () =>
      notificationService.subscribeToForegroundMessages((message) => {
        if (
          !('Notification' in window) ||
          Notification.permission !== 'granted'
        ) {
          return;
        }

        const notification = new Notification(message.title, {
          body: message.body,
          data: { link: message.link },
          tag: message.type,
        });

        notification.onclick = () => {
          window.focus();
          window.location.assign(message.link || '/app/today');
        };
      }),
    [notificationService],
  );

  return children;
}

function MobileSessionBridge({ children }: { children: ReactNode }) {
  const { mobileDeviceService } = useServices();
  const { state } = useAuth();
  const user = state.user;

  useEffect(() => {
    if (!user) {
      void mobileDeviceService.clearSessionHint();
      return;
    }

    void mobileDeviceService.saveSessionHint({
      displayName: user.displayName,
      email: user.email,
      lastRoute: getCurrentPath(),
      lastSignedInAtIso: new Date().toISOString(),
      userId: user.uid,
    });
  }, [mobileDeviceService, user]);

  useEffect(() => {
    if (!user || typeof window === 'undefined') {
      return undefined;
    }

    const updateRouteHint = () => {
      void mobileDeviceService.saveSessionHint({
        displayName: user.displayName,
        email: user.email,
        lastRoute: getCurrentPath(),
        lastSignedInAtIso: new Date().toISOString(),
        userId: user.uid,
      });
    };

    window.addEventListener('pagehide', updateRouteHint);
    window.addEventListener('visibilitychange', updateRouteHint);

    return () => {
      window.removeEventListener('pagehide', updateRouteHint);
      window.removeEventListener('visibilitychange', updateRouteHint);
    };
  }, [mobileDeviceService, user]);

  return children;
}

function getCurrentPath() {
  if (typeof window === 'undefined') {
    return null;
  }

  return `${window.location.pathname}${window.location.search}`;
}
