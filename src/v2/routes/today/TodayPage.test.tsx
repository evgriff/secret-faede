import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ComponentProps } from 'react';

import type { GardenTask } from '../../domain';
import { createInitialWaterBalance } from '../../domain/watering';
import {
  BASELINE_AT,
  NOW,
  calculate,
  makePlanting,
  target,
} from '../../domain/watering/wateringTestFixtures';
import { TodayPage } from './TodayPage';
import type { TodayLinkProps } from './types';

const Link = ({ children, className, to }: TodayLinkProps) => (
  <a {...(className ? { className } : {})} href={to}>
    {children}
  </a>
);

function recommendations() {
  const tomato = makePlanting('tomato-group', 'Tomato');
  const lettuce = makePlanting('lettuce-group', 'Lettuce');
  return calculate({
    balances: [
      createInitialWaterBalance({
        asOfIso: BASELINE_AT,
        cropGroupId: tomato.id,
        depletionInches: 1,
      }),
    ],
    targets: [target(tomato), target(lettuce)],
  }).recommendations.map((recommendation) => ({
    ...recommendation,
    target: {
      ...recommendation.target,
      deepLink: `/app/today?focus=watering&cropGroupId=${recommendation.target.cropGroupId}`,
    },
  }));
}

function task(): GardenTask {
  return {
    completedAtIso: null,
    createdAtIso: '2026-07-01T12:00:00.000Z',
    dueOn: '2026-07-09',
    id: 'tie-tomatoes',
    kind: 'support',
    notes: 'Use the soft ties in the shed.',
    priority: 'high',
    reason: 'Keep stems upright before the next wind.',
    sourceId: 'tomato-group',
    status: 'open',
    target: {
      id: 'tomato-group',
      kind: 'plantingGroup',
      label: 'Tomato',
    },
    title: 'Tie tomatoes',
    updatedAtIso: '2026-07-01T12:00:00.000Z',
  };
}

function readyProps(): ComponentProps<typeof TodayPage> {
  return {
    isOnline: true,
    LinkComponent: Link,
    nowIso: NOW,
    onLogWatering: vi.fn().mockResolvedValue('saved'),
    onTaskAction: vi.fn().mockResolvedValue('saved'),
    recommendations: recommendations(),
    tasks: [task()],
    timezone: 'America/New_York',
    weather: {
      alerts: [
        {
          deepLink: '/app/today?focus=task&taskId=tie-tomatoes',
          detail: 'Secure tall crops before gusts arrive.',
          effectiveAtIso: '2026-07-09T18:00:00.000Z',
          expiresAtIso: '2026-07-10T02:00:00.000Z',
          id: 'wind-watch',
          severity: 'watch',
          title: 'Strong wind watch',
        },
      ],
      currentTemperatureF: 76,
      expectedRainInches: 0,
      highTemperatureF: 82,
      lowTemperatureF: 65,
      observedAtIso: NOW,
      precipitationProbabilityPercent: 10,
      quality: 'fresh',
      summary: 'Warm with a light breeze.',
    },
  };
}

describe('TodayPage', () => {
  it('renders one transparent watering card per crop group', () => {
    render(<TodayPage {...readyProps()} />);

    const tomatoCard = screen
      .getByRole('heading', { name: 'Tomato' })
      .closest('article');
    const lettuceCard = screen
      .getByRole('heading', { name: 'Lettuce' })
      .closest('article');
    expect(tomatoCard).not.toBeNull();
    expect(lettuceCard).not.toBeNull();
    if (!tomatoCard || !lettuceCard) return;

    expect(within(tomatoCard).getByText('Water now')).toBeVisible();
    expect(
      within(tomatoCard).getByText(/in · .*gal$/, { selector: 'strong' }),
    ).toBeVisible();
    expect(
      within(tomatoCard).getByRole('link', { name: 'Open crop details' }),
    ).toHaveAttribute('href', '/app/plan?plantingId=tomato-group');
    expect(within(lettuceCard).getByText('Check soil')).toBeVisible();
    expect(
      within(lettuceCard).queryByText('Recommendation'),
    ).not.toBeInTheDocument();
    expect(
      within(lettuceCard).getByText(/cannot support an exact amount/i),
    ).toBeVisible();
  });

  it('shows weather alerts and task actions with actionable links', async () => {
    const user = userEvent.setup();
    const onTaskAction = vi.fn().mockResolvedValue('saved');
    render(<TodayPage {...readyProps()} onTaskAction={onTaskAction} />);

    expect(
      screen.getByRole('heading', { name: 'Strong wind watch' }),
    ).toBeVisible();
    expect(screen.getByText('Warm with a light breeze.')).toBeVisible();
    expect(
      screen.getByRole('link', { name: 'Review affected work' }),
    ).toHaveAttribute('href', '/app/today?focus=task&taskId=tie-tomatoes');

    await user.click(screen.getByRole('button', { name: 'Snooze 1 day' }));
    await waitFor(() =>
      expect(onTaskAction).toHaveBeenCalledWith({
        action: 'snooze',
        nextDueOn: '2026-07-10',
        taskId: 'tie-tomatoes',
      }),
    );
    expect(screen.getByText('Task snoozed until tomorrow.')).toBeVisible();
  });

  it('moves keyboard focus to a recommendation opened from a deep link', async () => {
    render(
      <TodayPage {...readyProps()} focus="watering" focusId="tomato-group" />,
    );
    const card = screen
      .getByRole('heading', { name: 'Tomato' })
      .closest('article');
    expect(card).not.toBeNull();
    await waitFor(() => expect(document.activeElement).toBe(card));
  });

  it('logs skipped watering with zero credit and no amount', async () => {
    const user = userEvent.setup();
    const onLogWatering = vi.fn().mockResolvedValue('saved');
    render(<TodayPage {...readyProps()} onLogWatering={onLogWatering} />);
    const tomatoCard = screen
      .getByRole('heading', { name: 'Tomato' })
      .closest('article');
    expect(tomatoCard).not.toBeNull();
    if (!tomatoCard) return;

    await user.click(
      within(tomatoCard).getByRole('button', { name: 'Log watering decision' }),
    );
    await user.click(screen.getByRole('radio', { name: /Skipped/ }));
    await user.type(
      await screen.findByLabelText(/Why was it skipped/),
      'Rain arrived early',
    );
    await user.click(screen.getByRole('button', { name: 'Save decision' }));

    await waitFor(() => expect(onLogWatering).toHaveBeenCalledTimes(1));
    expect(onLogWatering).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: null,
        creditedDepthInches: 0,
        cropGroupId: 'tomato-group',
        occurredOn: '2026-07-09',
        outcome: 'skipped',
        skipReason: 'Rain arrived early',
      }),
    );
    expect(screen.getByText(/zero water credit/i)).toBeVisible();
  });

  it('provides loading, error, retry, and empty states', async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    const props = readyProps();
    const { rerender } = render(<TodayPage {...props} loadState="loading" />);
    expect(screen.getByRole('status')).toHaveTextContent('Loading Today');

    rerender(<TodayPage {...props} loadState="error" onRetry={onRetry} />);
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(onRetry).toHaveBeenCalledOnce();

    rerender(
      <TodayPage {...props} recommendations={[]} tasks={[]} weather={null} />,
    );
    expect(
      screen.getByRole('heading', { name: 'No field work is ready yet' }),
    ).toBeVisible();
    expect(screen.getByText(/Weather is unavailable/)).toBeVisible();
  });
});
