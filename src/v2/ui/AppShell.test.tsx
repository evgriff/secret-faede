import { render, screen, waitFor } from '@testing-library/react';

import { AppShell } from './AppShell';
import { RouteAnnouncement } from './RouteAnnouncement';

const navigation = [
  { href: '/app/plan', label: 'Plan' },
  { href: '/app/today', label: 'Today' },
  { href: '/app/feed', label: 'Feed' },
  { href: '/app/settings', label: 'Settings' },
] as const;

describe('AppShell', () => {
  it('provides a skip link and marks the active route in both responsive navs', () => {
    render(
      <AppShell
        activePath="/app/today"
        headerStatus={<span>Synced</span>}
        navigation={navigation}
        userLabel="Primary gardener"
      >
        <h1>Today</h1>
      </AppShell>,
    );

    expect(
      screen.getByRole('link', { name: 'Skip to main content' }),
    ).toHaveAttribute('href', '#main-content');
    expect(screen.getByRole('main')).toHaveAttribute('tabindex', '-1');
    expect(
      document.querySelectorAll('nav[aria-label="Garden workspace"]'),
    ).toHaveLength(2);
    const todayLinks = Array.from(
      document.querySelectorAll<HTMLAnchorElement>('a[href="/app/today"]'),
    );
    expect(todayLinks).toHaveLength(2);
    todayLinks.forEach((link) => {
      expect(link).toHaveAttribute('aria-current', 'page');
    });
    expect(screen.getByText('Synced')).toBeVisible();
  });
});

describe('RouteAnnouncement', () => {
  it('sets the document title, announces the route, and moves focus', async () => {
    const { rerender } = render(
      <>
        <RouteAnnouncement routeKey="plan" title="Plan" />
        <h1 id="route-heading">Plan</h1>
      </>,
    );

    await waitFor(() =>
      expect(document.activeElement).toHaveTextContent('Plan'),
    );
    expect(document.title).toBe('Plan · Secret Faeries');
    expect(screen.getByRole('status')).toHaveTextContent('Plan page loaded');

    rerender(
      <>
        <RouteAnnouncement routeKey="today" title="Today" />
        <h1 id="route-heading">Today</h1>
      </>,
    );

    await waitFor(() =>
      expect(document.activeElement).toHaveTextContent('Today'),
    );
    expect(document.title).toBe('Today · Secret Faeries');
  });
});
