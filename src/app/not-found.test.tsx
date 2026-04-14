import { screen } from '@testing-library/react';

import { renderRoute } from '../test/render';
import { createTestServices } from '../test/testServices';

describe('NotFoundPage', () => {
  it('renders a stable fallback route', async () => {
    const services = await createTestServices();

    renderRoute('/does-not-exist', services);

    expect(await screen.findByText('That route does not exist.')).toBeVisible();
  });
});
