import { describe, expect, it } from 'vitest';

import { mapDelivery } from './useDeliveryHistory';

describe('notification delivery history mapping', () => {
  it('reports provider acceptance as sent rather than device delivery', () => {
    expect(
      mapDelivery('delivery-1', {
        body: 'Water tomatoes.',
        channel: 'push',
        createdAtIso: '2026-07-09T12:00:00.000Z',
        status: 'sent',
        title: 'Water tomatoes',
        type: 'watering',
      }),
    ).toMatchObject({ channel: 'push', status: 'sent' });
  });

  it('rejects malformed delivery timestamps instead of inventing history', () => {
    expect(() =>
      mapDelivery('delivery-1', {
        createdAtIso: 'not-an-instant',
        status: 'failed',
      }),
    ).toThrow(/timestamp/i);
  });
});
