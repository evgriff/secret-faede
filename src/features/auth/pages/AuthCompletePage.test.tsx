import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { renderRoute } from '../../../test/render';
import { createTestServices } from '../../../test/testServices';

describe('AuthCompletePage', () => {
  it('prompts for the email address when the link is opened on a different device', async () => {
    const user = userEvent.setup();
    const services = await createTestServices();
    const request = await services.authService.requestEmailSignIn(
      'primary.gardener@example.com',
    );

    if (!request.completionPath) {
      throw new Error('Expected a mock completion path.');
    }

    window.localStorage.removeItem('secret-faede.auth.pending-email');
    window.history.pushState({}, '', request.completionPath);

    renderRoute(request.completionPath, services);

    expect(
      await screen.findByText(
        'Re-enter the email address that received the link.',
      ),
    ).toBeVisible();

    await user.type(screen.getByLabelText('Email'), 'primary.gardener@example.com');
    await user.click(screen.getByRole('button', { name: 'Complete sign-in' }));

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: 'Garden editor' }),
      ).toBeVisible();
    });
  });
});
