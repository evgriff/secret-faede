import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import {
  createDefaultGarden,
  createDefaultPlanting,
} from '../../domain/gardens/GardenRepository';
import { renderRoute } from '../../test/render';
import { createTestServices } from '../../test/testServices';

describe('TodayPage', () => {
  it('adds a quick manual field task', async () => {
    const user = userEvent.setup();
    const services = await createTestServices({
      signedInEmail: 'primary.gardener@example.com',
    });

    renderRoute('/app/today', services);

    await screen.findByRole('heading', { name: 'Today' }, { timeout: 20_000 });
    await user.type(await screen.findByLabelText('Task'), 'Check seedlings');
    await user.selectOptions(screen.getByLabelText('Type'), 'inspect');
    await user.click(screen.getByRole('button', { name: 'Add task' }));

    expect(
      await screen.findByRole('heading', { name: 'Check seedlings' }),
    ).toBeVisible();
    expect(screen.getAllByText('Inspect').length).toBeGreaterThan(0);
  }, 20_000);

  it('creates a follow-up task from a field issue', async () => {
    const user = userEvent.setup();
    const services = await createTestServices({
      signedInEmail: 'primary.gardener@example.com',
    });

    renderRoute('/app/today', services);

    await user.click(await screen.findByText('Field entry'));
    await user.click(screen.getByRole('button', { name: 'Report issue' }));
    await user.selectOptions(screen.getByLabelText('Severity'), 'high');
    await user.type(
      screen.getByPlaceholderText(
        'What changed, where it is, what you already tried',
      ),
      'Chewed leaves on the first row.',
    );
    await user.click(screen.getByRole('button', { name: 'Create issue task' }));

    expect(
      await screen.findByRole('heading', {
        name: 'Inspect Whole garden: Field issue',
      }),
    ).toBeVisible();
    expect(screen.getAllByText('Inspect').length).toBeGreaterThan(0);
  });

  it('updates crop stage from Today and records field activity', async () => {
    const user = userEvent.setup();
    const services = await createTestServices({
      signedInEmail: 'primary.gardener@example.com',
    });
    const authUser = services.authService.getCurrentUser();

    if (!authUser) {
      throw new Error('Expected a signed-in test user.');
    }

    await services.gardenRepository.saveGarden({
      ...createDefaultGarden(authUser.uid),
      plantings: [
        {
          ...createDefaultPlanting({
            id: 'tomato-1',
            label: 'Tomato',
            xFt: 3,
            yFt: 3,
          }),
          cropId: 'tomato',
          status: 'planned',
        },
      ],
    });

    renderRoute('/app/today', services);

    await user.click(
      await screen.findByRole('button', { name: 'Mark planted' }),
    );

    expect(
      await screen.findByRole('button', { name: 'Mark growing' }),
    ).toBeVisible();
    expect(await screen.findByText('Crop status updated.')).toBeVisible();
  });

  it('opens a dismissable harvest sheet from Today and saves without a photo note flow', async () => {
    const user = userEvent.setup();
    const services = await createTestServices({
      signedInEmail: 'primary.gardener@example.com',
    });
    const authUser = services.authService.getCurrentUser();

    if (!authUser) {
      throw new Error('Expected a signed-in test user.');
    }

    await services.gardenRepository.saveGarden({
      ...createDefaultGarden(authUser.uid),
      plantings: [
        {
          ...createDefaultPlanting({
            id: 'tomato-1',
            label: 'Tomato',
            xFt: 3,
            yFt: 3,
          }),
          cropId: 'tomato',
          plantedOn: '2026-04-01',
          status: 'harvest-ready',
        },
      ],
    });

    renderRoute('/app/today', services);

    const harvestTitle = await screen.findByRole('heading', { name: 'Tomato' });
    const harvestCard = harvestTitle.closest('article');

    if (!harvestCard) {
      throw new Error('Expected the harvest card to render.');
    }

    await user.click(
      within(harvestCard).getByRole('button', { name: 'Log harvest' }),
    );

    const harvestDialog = await screen.findByRole('dialog', {
      name: 'Log harvest',
    });

    expect(harvestDialog).toBeVisible();
    expect(within(harvestDialog).getByLabelText('Crop')).toHaveValue(
      'tomato-1',
    );
    await user.click(
      within(harvestDialog).getByRole('button', { name: 'Close quick action' }),
    );
    expect(
      screen.queryByRole('dialog', { name: 'Log harvest' }),
    ).not.toBeInTheDocument();

    await user.click(
      within(harvestCard).getByRole('button', { name: 'Log harvest' }),
    );
    await user.click(screen.getByRole('button', { name: 'Save harvest' }));

    expect(await screen.findByText('Harvest saved to Feed.')).toBeVisible();
    expect(screen.queryByRole('dialog', { name: 'Add photo' })).toBeNull();
  });
});
