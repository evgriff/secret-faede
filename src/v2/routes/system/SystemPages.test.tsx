import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { GlobalErrorBoundary } from './GlobalErrorBoundary';
import { NotFoundPage } from './NotFoundPage';
import {
  BootstrapScreen,
  RouteErrorPage,
  classifyRouteError,
} from './RecoveryPages';

describe('system routes', () => {
  it('keeps the not-found page useful without claiming data was lost', () => {
    render(<NotFoundPage returnHref="/app/today" returnLabel="Open Today" />);

    expect(
      screen.getByRole('heading', {
        name: 'This path is not in the field book',
      }),
    ).toBeVisible();
    expect(screen.getByRole('link', { name: 'Open Today' })).toHaveAttribute(
      'href',
      '/app/today',
    );
    expect(screen.getByText(/garden data has not been changed/i)).toBeVisible();
  });

  it('distinguishes a stale app bundle from a normal route failure', () => {
    expect(
      classifyRouteError(
        new TypeError('Failed to fetch dynamically imported module'),
      ),
    ).toBe('stale-app-version');
    expect(classifyRouteError(new Error('garden query failed'))).toBe(
      'unexpected',
    );
  });

  it('prevents concurrent route retries and offers reload recovery', async () => {
    const user = userEvent.setup();
    let finish: () => void = () => undefined;
    const retry = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    const reload = vi.fn();
    render(
      <RouteErrorPage
        error={new Error('garden query failed')}
        onReload={reload}
        onRetry={retry}
      />,
    );

    const retryButton = screen.getByRole('button', {
      name: 'Try this page again',
    });
    await user.click(retryButton);
    await user.click(retryButton);
    expect(retry).toHaveBeenCalledTimes(1);
    expect(
      screen.getByRole('button', { name: 'Trying again…' }),
    ).toBeDisabled();

    finish();
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Try this page again' }),
      ).toBeEnabled(),
    );
    await user.click(screen.getByRole('button', { name: 'Reload app' }));
    expect(reload).toHaveBeenCalledOnce();
  });

  it('provides honest loading and bootstrap failure states', async () => {
    const { rerender } = render(<BootstrapScreen status="loading" />);
    expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true');

    const retry = vi.fn().mockRejectedValue(new Error('still offline'));
    rerender(<BootstrapScreen onRetry={retry} status="error" />);
    await userEvent.click(
      screen.getByRole('button', { name: 'Try opening again' }),
    );
    expect(await screen.findByText(/startup still failed/i)).toHaveAttribute(
      'role',
      'alert',
    );
  });
});

describe('GlobalErrorBoundary', () => {
  it('reports an error and can remount its children', async () => {
    const user = userEvent.setup();
    const onError = vi.fn();
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    let shouldThrow = true;

    function UnstablePage() {
      if (shouldThrow) {
        throw new Error('render failed');
      }
      return <h1>Recovered garden</h1>;
    }

    render(
      <GlobalErrorBoundary onError={onError}>
        <UnstablePage />
      </GlobalErrorBoundary>,
    );
    expect(
      await screen.findByRole('heading', {
        name: 'This page needs another try',
      }),
    ).toBeVisible();
    expect(onError).toHaveBeenCalledOnce();

    shouldThrow = false;
    await user.click(
      screen.getByRole('button', { name: 'Try this page again' }),
    );
    expect(
      await screen.findByRole('heading', { name: 'Recovered garden' }),
    ).toBeVisible();
    consoleError.mockRestore();
  });
});
