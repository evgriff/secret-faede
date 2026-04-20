import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { createDefaultGarden } from '../../domain/gardens/GardenRepository';
import { renderRoute } from '../../test/render';
import { createTestServices } from '../../test/testServices';

describe('GardenEditorScreen', () => {
  it('loads a default real-world plot without dirty save controls', async () => {
    const services = await createTestServices({
      signedInEmail: 'primary.gardener@example.com',
    });

    renderRoute('/app', services);

    expect(
      await screen.findByRole('heading', { name: 'Garden editor' }),
    ).toBeVisible();
    expect(await screen.findByText('12 ft by 8 ft')).toBeVisible();
    expect(
      screen.queryByRole('button', { name: 'Save' }),
    ).not.toBeInTheDocument();
  });

  it('adds a plant at the snapped plot center and marks the garden dirty', async () => {
    const user = userEvent.setup();
    const services = await createTestServices({
      signedInEmail: 'primary.gardener@example.com',
    });

    renderRoute('/app', services);

    await user.click(await screen.findByRole('button', { name: 'Add' }));
    await user.click(screen.getByRole('button', { name: 'Add Plant' }));

    expect(
      await screen.findByRole('button', {
        name: 'Plant 1 at X: 6.0 ft, Y: 4.0 ft',
      }),
    ).toBeVisible();
    expect(await screen.findByText('X: 6.0 ft, Y: 4.0 ft')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Save' })).toBeVisible();
  });

  it('resizes the plot, clamps plants, and keeps changes unsaved', async () => {
    const user = userEvent.setup();
    const services = await createTestServices({
      signedInEmail: 'primary.gardener@example.com',
    });

    renderRoute('/app', services);

    await user.click(await screen.findByRole('button', { name: 'Add' }));
    await user.click(screen.getByRole('button', { name: 'Add Plant' }));
    await user.click(screen.getByRole('button', { name: 'Plot' }));
    await user.clear(screen.getByLabelText('Width in feet'));
    await user.type(screen.getByLabelText('Width in feet'), '4');
    await user.clear(screen.getByLabelText('Depth in feet'));
    await user.type(screen.getByLabelText('Depth in feet'), '3');
    await user.click(screen.getByRole('button', { name: 'Save plot' }));

    expect(await screen.findByText('4 ft by 3 ft')).toBeVisible();
    expect(await screen.findByText('X: 4.0 ft, Y: 3.0 ft')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Save' })).toBeVisible();
  });

  it('selects a saved plant without marking the garden dirty', async () => {
    const user = userEvent.setup();
    const services = await createTestServices({
      signedInEmail: 'primary.gardener@example.com',
    });
    const currentUser = services.authService.getCurrentUser();

    if (!currentUser) {
      throw new Error('Expected signed-in test user.');
    }

    await services.gardenRepository.saveGarden({
      ...createDefaultGarden(currentUser.uid),
      plants: [{ id: 'plant-1', type: 'plant', xFt: 2.5, yFt: 3 }],
    });

    renderRoute('/app', services);

    await user.click(
      await screen.findByRole('button', {
        name: 'Plant 1 at X: 2.5 ft, Y: 3.0 ft',
      }),
    );

    expect(await screen.findByText('X: 2.5 ft, Y: 3.0 ft')).toBeVisible();
    expect(
      screen.queryByRole('button', { name: 'Save' }),
    ).not.toBeInTheDocument();
  });
});
