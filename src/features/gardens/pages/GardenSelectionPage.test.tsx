import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { renderRoute } from '../../../test/render';
import { createTestServices } from '../../../test/testServices';

describe('GardenSelectionPage', () => {
  it('lets the user select a garden and reach the garden shell', async () => {
    const user = userEvent.setup();
    const services = await createTestServices({
      signedInEmail: 'gardener@example.com',
    });

    renderRoute('/gardens', services);

    const selectButtons = await screen.findAllByRole('button', {
      name: 'Select garden',
    });
    const firstButton = selectButtons[0];

    if (!firstButton) {
      throw new Error('Expected at least one garden selection button.');
    }

    await user.click(firstButton);

    expect(
      await screen.findByRole('heading', { name: 'North Lot' }),
    ).toBeVisible();
  });
});
