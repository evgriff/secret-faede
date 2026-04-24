import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import {
  createDefaultGarden,
  createDefaultPlanting,
  type Task,
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

    await user.type(await screen.findByLabelText('Task'), 'Check seedlings');
    await user.selectOptions(screen.getByLabelText('Type'), 'inspect');
    await user.click(screen.getByRole('button', { name: 'Add task' }));

    expect(
      await screen.findByRole('heading', { name: 'Check seedlings' }),
    ).toBeVisible();
    expect(screen.getAllByText('Inspect').length).toBeGreaterThan(0);
  });

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

  it('logs a harvest from Today with one tap', async () => {
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
          status: 'harvest-ready',
        },
      ],
      tasks: [createHarvestTask(authUser.uid)],
    });

    renderRoute('/app/today', services);

    const detailsButton = await screen.findByRole('button', {
      name: 'Details',
    });
    const harvestCard = detailsButton.closest('article');

    if (!harvestCard) {
      throw new Error('Expected the harvest card to render.');
    }

    await user.click(
      within(harvestCard).getByRole('button', { name: 'Log harvest' }),
    );

    expect(
      await screen.findByText(
        'Harvest saved. Add a photo if it helps the memory.',
      ),
    ).toBeVisible();
    expect(
      await screen.findByRole('dialog', { name: 'Add photo' }),
    ).toBeVisible();
  });
});

function createHarvestTask(gardenId: string): Task {
  return {
    bedLabel: 'Main bed',
    completedAtIso: null,
    createdAtIso: '2026-06-21T11:00:00.000Z',
    deferredUntilDate: null,
    dueDate: null,
    gardenId,
    id: 'planting-tomato-1-harvest',
    notes: 'Pick ripe fruit.',
    plantingId: 'tomato-1',
    priority: 'medium',
    snoozedUntilDate: null,
    source: 'generated',
    sourceId: 'tomato-1',
    status: 'open',
    structureId: null,
    title: 'Harvest Tomato',
    type: 'harvest',
  };
}
