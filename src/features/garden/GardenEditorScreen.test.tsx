import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import {
  createDefaultGarden,
  createDefaultPlanting,
} from '../../domain/gardens/GardenRepository';
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

    await addTomato(user);

    expect(
      await screen.findByRole('button', {
        name: 'Tomato at X: 6.0 ft, Y: 4.0 ft',
      }),
    ).toBeVisible();
    expect(await screen.findByText('X: 6.0 ft, Y: 4.0 ft')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Save' })).toBeVisible();
  });

  it('filters the add-plant picker by crop metadata', async () => {
    const user = userEvent.setup();
    const services = await createTestServices({
      signedInEmail: 'primary.gardener@example.com',
    });

    renderRoute('/app', services);

    await user.click(await screen.findByRole('button', { name: 'Add' }));
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Water' }),
      'high',
    );

    expect(
      await screen.findByRole('button', { name: 'Cucumber crop' }),
    ).toBeVisible();
    expect(
      screen.queryByRole('button', { name: 'Basil crop' }),
    ).not.toBeInTheDocument();
  });

  it('adds structures and shows the selected item inspector', async () => {
    const user = userEvent.setup();
    const services = await createTestServices({
      signedInEmail: 'primary.gardener@example.com',
    });

    renderRoute('/app', services);

    await user.selectOptions(
      await screen.findByRole('combobox', { name: 'Structure type' }),
      'trellis',
    );
    await user.click(screen.getByRole('button', { name: 'Add structure' }));

    expect(
      await screen.findByRole('button', {
        name: 'Trellis at X: 1.0 ft, Y: 1.0 ft',
      }),
    ).toBeVisible();
    expect(
      screen.getByRole('complementary', {
        name: 'Selected item inspector',
      }),
    ).toHaveTextContent('Trellis');
    expect(screen.getByRole('button', { name: 'Save' })).toBeVisible();
  });

  it('warns when planting spacing is unrealistic', async () => {
    const user = userEvent.setup();
    const services = await createTestServices({
      signedInEmail: 'primary.gardener@example.com',
    });

    renderRoute('/app', services);

    await addTomato(user);
    await addTomato(user);

    expect(await screen.findByText('1 spacing warning')).toBeVisible();
  });

  it('recalculates and manually overrides the sun layer', async () => {
    const user = userEvent.setup();
    const services = await createTestServices({
      signedInEmail: 'primary.gardener@example.com',
    });

    renderRoute('/app', services);

    await user.click(
      await screen.findByRole('button', { name: 'Recalculate sun' }),
    );
    await user.click(screen.getByLabelText('Sun layer'));
    await user.click(screen.getByLabelText('Paint'));
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Manual sun exposure' }),
      'fullShade',
    );
    await user.click(
      await screen.findByRole('button', { name: 'Sun cell 0, 0' }),
    );

    expect(screen.getByRole('button', { name: 'Save' })).toBeVisible();
  });

  it('generates weather-based watering recommendations', async () => {
    const user = userEvent.setup();
    const services = await createTestServices({
      signedInEmail: 'primary.gardener@example.com',
    });

    renderRoute('/app', services);

    await addTomato(user);
    await user.click(screen.getByRole('button', { name: 'Update weather' }));

    expect(await screen.findByText(/Sunny/)).toBeVisible();
    expect(await screen.findByText(/Tomato:/)).toBeVisible();
    expect(await screen.findAllByText(/Heat stress/)).not.toHaveLength(0);
  });

  it('resizes the plot, clamps plants, and keeps changes unsaved', async () => {
    const user = userEvent.setup();
    const services = await createTestServices({
      signedInEmail: 'primary.gardener@example.com',
    });

    renderRoute('/app', services);

    await addTomato(user);
    await user.click(screen.getByRole('button', { name: 'Plot' }));
    await user.clear(screen.getByLabelText('Width in feet'));
    await user.type(screen.getByLabelText('Width in feet'), '4');
    await user.clear(screen.getByLabelText('Depth in feet'));
    await user.type(screen.getByLabelText('Depth in feet'), '3');
    await user.clear(screen.getByLabelText('North orientation degrees'));
    await user.type(screen.getByLabelText('North orientation degrees'), '45');
    await user.clear(screen.getByLabelText('Latitude'));
    await user.type(screen.getByLabelText('Latitude'), '42.28');
    await user.clear(screen.getByLabelText('Longitude'));
    await user.type(screen.getByLabelText('Longitude'), '-83.74');
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
      plantings: [
        createDefaultPlanting({
          id: 'planting-1',
          label: 'Saved tomato',
          xFt: 2.5,
          yFt: 3,
        }),
      ],
    });

    renderRoute('/app', services);

    await user.click(
      await screen.findByRole('button', {
        name: 'Saved tomato at X: 2.5 ft, Y: 3.0 ft',
      }),
    );

    expect(await screen.findByText('X: 2.5 ft, Y: 3.0 ft')).toBeVisible();
    expect(
      screen.queryByRole('button', { name: 'Save' }),
    ).not.toBeInTheDocument();
  });
});

async function addTomato(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('button', { name: 'Add' }));
  await user.clear(screen.getByRole('searchbox', { name: 'Search crops' }));
  await user.type(
    screen.getByRole('searchbox', { name: 'Search crops' }),
    'tomato',
  );
  await user.click(await screen.findByRole('button', { name: 'Tomato crop' }));
  await user.click(screen.getByRole('button', { name: 'Add plant' }));
}
