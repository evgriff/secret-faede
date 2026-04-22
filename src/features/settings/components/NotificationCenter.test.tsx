import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';

import type { NotificationLog } from '../../../domain/gardens/GardenRepository';
import { NotificationCenter } from './NotificationCenter';

describe('NotificationCenter', () => {
  it('separates active alerts from recent history and links to the right surface', async () => {
    const user = userEvent.setup();
    const onAcknowledge = vi.fn();
    const onDismiss = vi.fn();
    const onSnooze = vi.fn();

    render(
      <MemoryRouter>
        <NotificationCenter
          logs={[
            createLog({
              body: 'Water tomatoes 0.5 in today.',
              deepLink: '/app/today',
              id: 'active-water',
              messageSummary: 'Water tomatoes today',
              type: 'watering',
            }),
            createLog({
              acknowledgedAtIso: '2026-06-21T12:00:00.000Z',
              body: 'Cover basil tonight.',
              id: 'ack-frost',
              messageSummary: 'Frost acknowledged',
              type: 'frost',
            }),
            createLog({
              body: 'Water greens tomorrow.',
              id: 'snoozed-water',
              messageSummary: 'Water greens',
              snoozedUntilIso: '2099-06-22T12:00:00.000Z',
              type: 'watering',
            }),
          ]}
          onAcknowledge={onAcknowledge}
          onDismiss={onDismiss}
          onSnooze={onSnooze}
        />
      </MemoryRouter>,
    );

    const activeList = screen.getByLabelText('Active alerts');
    const recentList = screen.getByLabelText('Recent alerts');

    expect(within(activeList).getByText('Water tomatoes today')).toBeVisible();
    expect(within(recentList).getByText('Frost acknowledged')).toBeVisible();
    expect(within(recentList).getByText('Water greens')).toBeVisible();
    expect(
      within(activeList).getByRole('link', { name: 'Open Today' }),
    ).toHaveAttribute('href', '/app/today');

    await user.click(
      within(activeList).getByRole('button', { name: 'Snooze 1 day' }),
    );

    expect(onSnooze).toHaveBeenCalledWith('active-water');
    expect(onAcknowledge).not.toHaveBeenCalled();
    expect(onDismiss).not.toHaveBeenCalled();
  });
});

function createLog(overrides: Partial<NotificationLog>): NotificationLog {
  return {
    acknowledgedAtIso: null,
    attemptCount: 1,
    body: 'Alert body',
    channel: 'inApp',
    createdAtIso: '2026-06-21T11:00:00.000Z',
    decisionReason: 'allowed',
    dedupeKey: null,
    deepLink: '/app/today',
    dismissedAtIso: null,
    dryRun: false,
    errorMessage: null,
    gardenId: 'user-a',
    id: 'log-1',
    messageSummary: 'Alert summary',
    provider: 'inApp',
    providerMessageId: null,
    providerStatus: 'recorded',
    recipientRedacted: 'in-app',
    retryPolicy: null,
    sentAtIso: '2026-06-21T11:00:00.000Z',
    snoozedUntilIso: null,
    status: 'sent',
    taskId: null,
    type: 'watering',
    userId: 'user-a',
    ...overrides,
  };
}
