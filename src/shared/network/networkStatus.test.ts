import { getNetworkStatus, isBrowserOffline } from './networkStatus';

describe('networkStatus', () => {
  const originalDescriptor = Object.getOwnPropertyDescriptor(
    Navigator.prototype,
    'onLine',
  );

  afterEach(() => {
    if (originalDescriptor) {
      Object.defineProperty(Navigator.prototype, 'onLine', originalDescriptor);
    }
  });

  it('reports browser online and offline status', () => {
    setNavigatorOnline(false);

    expect(getNetworkStatus()).toBe('offline');
    expect(isBrowserOffline()).toBe(true);

    setNavigatorOnline(true);

    expect(getNetworkStatus()).toBe('online');
    expect(isBrowserOffline()).toBe(false);
  });
});

function setNavigatorOnline(value: boolean) {
  Object.defineProperty(Navigator.prototype, 'onLine', {
    configurable: true,
    get: () => value,
  });
}
