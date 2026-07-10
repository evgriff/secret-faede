import { createContext, useContext, type ReactNode } from 'react';

import type { V2Services } from './services';

const ServicesContext = createContext<V2Services | null>(null);

export function V2ServicesProvider({
  children,
  services,
}: {
  children: ReactNode;
  services: V2Services;
}) {
  return (
    <ServicesContext.Provider value={services}>
      {children}
    </ServicesContext.Provider>
  );
}

export function useV2Services() {
  const services = useContext(ServicesContext);
  if (!services) {
    throw new Error('useV2Services must be used inside V2ServicesProvider.');
  }
  return services;
}
