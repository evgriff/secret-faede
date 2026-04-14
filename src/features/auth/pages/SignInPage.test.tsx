import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { renderRoute } from '../../../test/render';
import { createTestServices } from '../../../test/testServices';

describe('SignInPage', () => {
  it('validates email input and shows the mock completion affordance', async () => {
    const user = userEvent.setup();
    const services = await createTestServices();

    renderRoute('/sign-in', services);

    await user.click(screen.getByRole('button', { name: 'Send sign-in link' }));

    expect(
      await screen.findByText(
        'Enter a valid email address to receive the sign-in link.',
      ),
    ).toBeVisible();

    await user.type(screen.getByLabelText('Email'), 'gardener@example.com');
    await user.click(screen.getByRole('button', { name: 'Send sign-in link' }));

    expect(
      await screen.findByRole('link', { name: 'Use mock sign-in link' }),
    ).toBeVisible();
  });
});
