import { useEffect, useState } from 'react';

export type NetworkStatus = 'offline' | 'online';

export interface NetworkStatusAdapter {
  getNetworkStatus(): Promise<NetworkStatus>;
  subscribeToNetworkStatus(
    callback: (status: NetworkStatus) => void,
  ): () => void;
}

let networkStatusAdapter: NetworkStatusAdapter | null = null;

export function configureNetworkStatusAdapter(
  adapter: NetworkStatusAdapter | null,
) {
  networkStatusAdapter = adapter;
}

export function getNetworkStatus(): NetworkStatus {
  if (typeof navigator === 'undefined') {
    return 'online';
  }

  return navigator.onLine ? 'online' : 'offline';
}

export function isBrowserOffline() {
  return getNetworkStatus() === 'offline';
}

export function useNetworkStatus() {
  const [status, setStatus] = useState<NetworkStatus>(() => getNetworkStatus());

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    const updateStatus = () => setStatus(getNetworkStatus());
    let removeAdapterListener: (() => void) | null = null;
    let active = true;

    if (networkStatusAdapter) {
      void networkStatusAdapter.getNetworkStatus().then((nextStatus) => {
        if (active) {
          setStatus(nextStatus);
        }
      });
      removeAdapterListener =
        networkStatusAdapter.subscribeToNetworkStatus(setStatus);
    }

    window.addEventListener('online', updateStatus);
    window.addEventListener('offline', updateStatus);

    return () => {
      active = false;
      removeAdapterListener?.();
      window.removeEventListener('online', updateStatus);
      window.removeEventListener('offline', updateStatus);
    };
  }, []);

  return status;
}
