import { createContext, useContext, useMemo, type ReactNode } from 'react';

import { AuthProvider } from '../features/auth/auth-context';
import {
  createRuntimeServices,
  type AppServices,
} from '../infrastructure/runtime/services';

const ServicesContext = createContext<AppServices | null>(null);

export function AppProviders({
  children,
  services,
}: {
  children: ReactNode;
  services?: AppServices;
}) {
  const resolvedServices = useMemo(
    () => services ?? createRuntimeServices(),
    [services],
  );

  return (
    <ServicesContext.Provider value={resolvedServices}>
      <AuthProvider>{children}</AuthProvider>
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
