import { useEffect, useState } from 'react';

export type NetworkStatus = 'offline' | 'online';

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

    window.addEventListener('online', updateStatus);
    window.addEventListener('offline', updateStatus);

    return () => {
      window.removeEventListener('online', updateStatus);
      window.removeEventListener('offline', updateStatus);
    };
  }, []);

  return status;
}
