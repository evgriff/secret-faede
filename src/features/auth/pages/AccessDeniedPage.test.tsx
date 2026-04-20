import { screen } from '@testing-library/react';

import { renderRoute } from '../../../test/render';
import { createTestServices } from '../../../test/testServices';

describe('AccessDeniedPage', () => {
  it('renders calm copy for unauthorized users', async () => {
    const services = await createTestServices({
      signedInEmail: 'blocked@example.com',
    });

    renderRoute('/access-denied', services);

    expect(
      await screen.findByRole('heading', {
        name: 'This email address is not authorized.',
      }),
    ).toBeVisible();
  });
});
