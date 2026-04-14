import { screen } from '@testing-library/react';

import { renderRoute } from '../../../test/render';
import { createTestServices } from '../../../test/testServices';

describe('GardenHomePage', () => {
  it('shows starter plots from the repository seam', async () => {
    const services = await createTestServices({
      signedInEmail: 'gardener@example.com',
    });

    renderRoute('/gardens/north-lot', services);

    expect(
      await screen.findByRole('heading', { name: 'North Lot' }),
    ).toBeVisible();
    expect(await screen.findByText('Kitchen Bed')).toBeVisible();
    expect(screen.getByText('Herb Corner')).toBeVisible();
  });
});
