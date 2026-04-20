import { createContext, useContext, useEffect, type ReactNode } from 'react';

import { AuthProvider } from '../features/auth/auth-context';
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
      <AuthProvider>
        <ForegroundPushBridge>{children}</ForegroundPushBridge>
      </AuthProvider>
    </ServicesContext.Provider>
  );
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

        new Notification(message.title, {
          body: message.body,
          tag: message.type,
        });
      }),
    [notificationService],
  );

  return children;
}
