import { fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import {
  annArborClimateProfile,
  createDefaultGarden,
  createDefaultPlanting,
} from '../../domain/gardens/GardenRepository';
import { withPlantingInstances } from '../../domain/gardens/plantingInstances';
import { renderRoute } from '../../test/render';
import { createTestServices } from '../../test/testServices';

describe('PlanPage', () => {
  it('launches first-run setup and creates a blank plan', async () => {
    const user = userEvent.setup();
    const services = await createTestServices({
      signedInEmail: 'primary.gardener@example.com',
    });

    renderRoute('/app/plan', services);

    expect(
      await screen.findByRole('heading', { name: 'Set up your garden' }),
    ).toBeVisible();
    expect(
      screen.getByRole('region', { name: 'Garden quick setup' }),
    ).toBeVisible();
    expect(screen.getByLabelText('Garden name')).toBeVisible();
    expect(screen.getByLabelText('Plot type')).toHaveValue('raisedBed');
    expect(screen.getByLabelText('Width in feet')).toHaveValue(12);
    expect(screen.getByLabelText('Depth in feet')).toHaveValue(8);
    await user.click(screen.getByText('Optional location and climate'));
    expect(await screen.findByLabelText('Location or address')).toHaveValue(
      'Detroit, MI',
    );
    expect(screen.getByDisplayValue('6a')).toBeVisible();

    await user.click(screen.getByLabelText(/Blank plan/));
    await user.click(screen.getByRole('button', { name: 'Create plan' }));

    expect(await screen.findByRole('heading', { name: 'Plan' })).toBeVisible();
    expect(await screen.findByText('12 ft by 8 ft')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Save' })).toBeVisible();
  });

  it('loads a default real-world plot without dirty save controls', async () => {
    const services = await createConfiguredPlanServices();

    renderRoute('/app/plan', services);

    expect(await screen.findByRole('heading', { name: 'Plan' })).toBeVisible();
    expect(await screen.findByText('12 ft by 8 ft')).toBeVisible();
    expect(
      screen.queryByRole('button', { name: 'Save' }),
    ).not.toBeInTheDocument();
  });

  it('adds a plant at the snapped plot center and marks the garden dirty', async () => {
    const user = userEvent.setup();
    const services = await createConfiguredPlanServices();

    renderRoute('/app/plan', services);

    await addTomato(user);

    const tomatoNode = await screen.findByRole('button', {
      name: 'Tomato at X: 6.0 ft, Y: 4.0 ft',
    });

    expect(tomatoNode).toBeVisible();
    expect(within(tomatoNode).getByText('Planned')).toBeVisible();
    expect(within(tomatoNode).getByText('Support')).toBeVisible();
    const focusCard = await screen.findByRole('complementary', {
      name: 'Crop focus',
    });
    expect(within(focusCard).getByText('X 6.0 ft, Y 4.0 ft')).toBeVisible();
    await user.click(within(focusCard).getByRole('tab', { name: 'Crop' }));
    expect(within(focusCard).getByText('1 plant node')).toBeVisible();
    await user.click(within(focusCard).getByRole('tab', { name: 'Needs' }));
    expect(within(focusCard).getByText(/Cage required/)).toBeVisible();
    expect(screen.getByRole('button', { name: 'Save' })).toBeVisible();
  });

  it('supports planting duplicate, lifecycle, lock, and delete flows', async () => {
    const user = userEvent.setup();
    const services = await createConfiguredPlanServices();

    renderRoute('/app/plan', services);

    await addTomato(user);
    await openFocusedPlantInspector(user);
    await user.click(screen.getByRole('button', { name: 'Duplicate' }));

    expect(
      await screen.findByRole('button', {
        name: 'Tomato copy at X: 6.5 ft, Y: 4.5 ft',
      }),
    ).toBeVisible();

    await user.click(screen.getByRole('tab', { name: 'Care' }));
    await user.selectOptions(
      screen.getByLabelText('Lifecycle'),
      'harvest-ready',
    );

    const anchoredNode = await screen.findByRole('button', {
      name: 'Tomato copy at X: 6.5 ft, Y: 4.5 ft',
    });

    expect(within(anchoredNode).getByText('Harvest')).toBeVisible();
    expect(within(anchoredNode).getByText('Anchored')).toBeVisible();
    expect(screen.getByLabelText('Lifecycle')).toHaveValue('harvest-ready');
    expect(await screen.findByText('Anchored in real garden')).toBeVisible();

    await user.click(screen.getByRole('tab', { name: 'Details' }));
    expect(await screen.findByText('Optimizer keeps anchored')).toBeVisible();
    expect(screen.getByText('Real-world anchor')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Allow relocation' }));
    expect(
      await screen.findByText('Relocation explicitly allowed'),
    ).toBeVisible();
    expect(
      screen.getByRole('button', { name: 'Stop relocation' }),
    ).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Lock' }));

    const lockedNode = await screen.findByRole('button', {
      name: 'Tomato copy at X: 6.5 ft, Y: 4.5 ft',
    });

    expect(within(lockedNode).getByText('Locked')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Unlock' })).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Delete' }));

    expect(
      screen.queryByRole('complementary', {
        name: 'Selected item inspector',
      }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', {
        name: 'Tomato copy at X: 6.5 ft, Y: 4.5 ft',
      }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save' })).toBeVisible();
  }, 15_000);

  it('undoes and redoes garden editing operations', async () => {
    const user = userEvent.setup();
    const services = await createConfiguredPlanServices();

    renderRoute('/app/plan', services);

    await addTomato(user);
    await user.keyboard('{Control>}z{/Control}');

    expect(
      screen.queryByRole('button', {
        name: 'Tomato at X: 6.0 ft, Y: 4.0 ft',
      }),
    ).not.toBeInTheDocument();

    await user.keyboard('{Control>}y{/Control}');

    expect(
      await screen.findByRole('button', {
        name: 'Tomato at X: 6.0 ft, Y: 4.0 ft',
      }),
    ).toBeVisible();
  });

  it('supports shift multi-select, group nudge, duplicate, delete, and undo', async () => {
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
      climateProfile: {
        ...annArborClimateProfile,
        source: 'user',
      },
      plantings: [
        createDefaultPlanting({
          id: 'planting-1',
          label: 'Saved tomato',
          xFt: 2,
          yFt: 3,
        }),
        createDefaultPlanting({
          id: 'planting-2',
          label: 'Saved basil',
          xFt: 4,
          yFt: 3,
        }),
      ],
    });

    renderRoute('/app/plan', services);

    await user.click(
      await screen.findByRole('button', {
        name: 'Saved tomato at X: 2.0 ft, Y: 3.0 ft',
      }),
    );
    fireEvent.pointerDown(
      await screen.findByRole('button', {
        name: 'Saved basil at X: 4.0 ft, Y: 3.0 ft',
      }),
      { shiftKey: true },
    );

    expect(await screen.findByText('2 selected')).toBeVisible();

    await user.keyboard('{ArrowRight}');

    expect(
      await screen.findByRole('button', {
        name: 'Saved tomato at X: 2.1 ft, Y: 3.0 ft',
      }),
    ).toBeVisible();
    expect(
      await screen.findByRole('button', {
        name: 'Saved basil at X: 4.1 ft, Y: 3.0 ft',
      }),
    ).toBeVisible();

    await user.keyboard('{Control>}z{/Control}');
    expect(
      await screen.findByRole('button', {
        name: 'Saved tomato at X: 2.0 ft, Y: 3.0 ft',
      }),
    ).toBeVisible();

    await user.keyboard('{Control>}y{/Control}');
    expect(
      await screen.findByRole('button', {
        name: 'Saved tomato at X: 2.1 ft, Y: 3.0 ft',
      }),
    ).toBeVisible();

    await user.click(
      await screen.findByRole('button', {
        name: 'Saved tomato at X: 2.1 ft, Y: 3.0 ft',
      }),
    );
    fireEvent.pointerDown(
      await screen.findByRole('button', {
        name: 'Saved basil at X: 4.1 ft, Y: 3.0 ft',
      }),
      { shiftKey: true },
    );
    expect(await screen.findByText('2 selected')).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Duplicate group' }));

    expect(
      await screen.findByRole('button', {
        name: 'Saved tomato copy at X: 2.6 ft, Y: 3.5 ft',
      }),
    ).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Delete group' }));

    expect(
      screen.queryByRole('button', {
        name: 'Saved tomato copy at X: 2.6 ft, Y: 3.5 ft',
      }),
    ).not.toBeInTheDocument();
    expect(
      await screen.findByRole('button', {
        name: 'Saved tomato at X: 2.1 ft, Y: 3.0 ft',
      }),
    ).toBeVisible();
  });

  it('filters the add-plant picker by crop metadata', async () => {
    const user = userEvent.setup();
    const services = await createConfiguredPlanServices();

    renderRoute('/app/plan', services);

    await clickMode(user, 'Plant');
    await user.click(
      await screen.findByRole('button', { name: 'Open plant picker' }),
    );
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

  it('builds a seasonal crop list for optimizer input', async () => {
    const user = userEvent.setup();
    const services = await createConfiguredPlanServices();

    renderRoute('/app/plan', services);

    const [choosePlantsButton] = await screen.findAllByRole('button', {
      name: 'Choose plants',
    });

    if (!choosePlantsButton) {
      throw new Error('Expected Choose plants action.');
    }

    await user.click(choosePlantsButton);
    expect(
      await screen.findByRole('dialog', { name: 'Choose Plants' }),
    ).toBeVisible();

    await user.clear(screen.getByRole('searchbox', { name: 'Search plants' }));
    await user.type(
      screen.getByRole('searchbox', { name: 'Search plants' }),
      'tomato',
    );
    await user.click(await screen.findByRole('button', { name: 'Add Tomato' }));

    const board = screen.getByRole('region', { name: 'Season crop board' });

    expect(within(board).getByText('Tomato')).toBeVisible();
    expect(within(board).getByText('Recommended form')).toBeVisible();
    expect(within(board).queryByLabelText('Need')).not.toBeInTheDocument();
    expect(within(board).queryByLabelText('Priority')).not.toBeInTheDocument();
    await user.clear(within(board).getByLabelText('How many plants?'));
    await user.type(within(board).getByLabelText('How many plants?'), '3');
    await user.click(screen.getByRole('button', { name: 'Save + Optimize' }));

    expect(screen.getByRole('button', { name: 'Save' })).toBeVisible();

    expect(await screen.findByText(/1 crop request/)).toBeVisible();
    expect(await screen.findByText(/Tomato/)).toBeVisible();
    expect(await screen.findByText(/3 target/)).toBeVisible();
    expect(screen.queryByText(/\d+\/100/)).not.toBeInTheDocument();
  });

  it('adds multiple plant nodes from the quantity-first picker', async () => {
    const user = userEvent.setup();
    const services = await createConfiguredPlanServices();

    renderRoute('/app/plan', services);

    await clickMode(user, 'Plant');
    await user.click(
      await screen.findByRole('button', { name: 'Open plant picker' }),
    );
    const search = await screen.findByRole('searchbox', {
      name: 'Search crops',
    });

    await user.clear(search);
    await user.type(search, 'carrot');
    await user.click(
      await screen.findByRole('button', { name: 'Carrot crop' }),
    );
    expect(
      screen.getByRole('region', { name: 'Planting arrangement' }),
    ).toBeVisible();
    await user.clear(screen.getByLabelText('How many plants?'));
    await user.type(screen.getByLabelText('How many plants?'), '3');

    expect(screen.getByText('Will create 3 plant nodes.')).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Add plant' }));

    expect(
      await screen.findByRole('button', {
        name: /Carrot 1 at X:/,
      }),
    ).toBeVisible();
    expect(
      screen.getByRole('button', { name: /Carrot 2 at X:/ }),
    ).toBeVisible();
    expect(
      screen.getByRole('button', { name: /Carrot 3 at X:/ }),
    ).toBeVisible();
  });

  it('clears the seasonal crop board from Choose Plants', async () => {
    const user = userEvent.setup();
    const services = await createConfiguredPlanServices();

    renderRoute('/app/plan', services);

    const [choosePlantsButton] = await screen.findAllByRole('button', {
      name: 'Choose plants',
    });

    if (!choosePlantsButton) {
      throw new Error('Expected Choose plants action.');
    }

    await user.click(choosePlantsButton);
    await user.type(
      screen.getByRole('searchbox', { name: 'Search plants' }),
      'tomato',
    );
    await user.click(await screen.findByRole('button', { name: 'Add Tomato' }));

    const board = screen.getByRole('region', { name: 'Season crop board' });
    expect(within(board).getByText('Tomato')).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Clear list' }));

    expect(within(board).getByText('No plants selected.')).toBeVisible();
    expect(
      screen.getByRole('button', { name: 'Save + Optimize' }),
    ).toBeDisabled();
  });

  it('compares a small set of crop planning tradeoffs from Choose Plants', async () => {
    const user = userEvent.setup();
    const services = await createConfiguredPlanServices();

    renderRoute('/app/plan', services);

    const [choosePlantsButton] = await screen.findAllByRole('button', {
      name: 'Choose plants',
    });

    if (!choosePlantsButton) {
      throw new Error('Expected Choose plants action.');
    }

    await user.click(choosePlantsButton);
    const searchBox = screen.getByRole('searchbox', { name: 'Search plants' });

    await user.type(searchBox, 'tomato');
    await user.click(
      await screen.findByRole('button', { name: 'Compare Tomato' }),
    );
    await user.clear(searchBox);
    await user.type(searchBox, 'basil');
    await user.click(
      await screen.findByRole('button', { name: 'Compare Basil' }),
    );

    const comparePanel = screen.getByRole('region', {
      name: 'Crop planning compare',
    });

    expect(within(comparePanel).getByText('Tomato')).toBeVisible();
    expect(within(comparePanel).getByText('Basil')).toBeVisible();
    expect(
      within(comparePanel).getAllByText(/Best planning match|Harder than/),
    ).toHaveLength(2);

    await user.click(
      within(comparePanel).getByRole('button', { name: 'Clear compare' }),
    );

    expect(
      within(comparePanel).getByText(/compare space, timing, and support/),
    ).toBeVisible();
  });

  it('searches specific generated crops from the full plant library', async () => {
    const user = userEvent.setup();
    const services = await createConfiguredPlanServices();

    renderRoute('/app/plan', services);

    const [choosePlantsButton] = await screen.findAllByRole('button', {
      name: 'Choose plants',
    });

    if (!choosePlantsButton) {
      throw new Error('Expected Choose plants action.');
    }

    await user.click(choosePlantsButton);
    await user.type(
      screen.getByRole('searchbox', { name: 'Search plants' }),
      'winter kale',
    );

    expect(
      await screen.findByRole('button', { name: 'Add Winter Kale' }),
    ).toBeVisible();
  });

  it('adds structures and shows the selected item inspector', async () => {
    const user = userEvent.setup();
    const services = await createConfiguredPlanServices();

    renderRoute('/app/plan', services);

    await clickMode(user, 'Structure');
    const supportTypeSelect = await screen.findByRole('combobox', {
      name: 'Garden support type',
    });
    expect(
      screen.queryByRole('option', { name: 'Legacy shade source' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('option', { name: 'Fence/wall' }),
    ).not.toBeInTheDocument();
    await user.selectOptions(supportTypeSelect, 'trellis');
    await user.click(
      screen.getByRole('button', { name: 'Place garden support' }),
    );

    expect(
      await screen.findByRole('button', {
        name: 'Trellis at X: 1.0 ft, Y: 1.0 ft',
      }),
    ).toBeVisible();
    expect(
      await screen.findByRole('complementary', {
        name: 'Selected item inspector',
      }),
    ).toHaveTextContent('Trellis');
    expect(screen.getByRole('button', { name: 'Save' })).toBeVisible();
  });

  it('places accessible path defaults from structure mode', async () => {
    const user = userEvent.setup();
    const services = await createConfiguredPlanServices();

    renderRoute('/app/plan', services);

    await clickMode(user, 'Structure');
    await user.selectOptions(
      await screen.findByRole('combobox', { name: 'Garden support type' }),
      'pathway',
    );
    await user.click(screen.getByLabelText('Accessible path defaults'));
    await user.click(
      screen.getByRole('button', { name: 'Place garden support' }),
    );

    expect(
      await screen.findByRole('button', {
        name: 'Pathway at X: 1.0 ft, Y: 0.0 ft',
      }),
    ).toBeVisible();
    expect(await screen.findByText('4 ft by 8 ft')).toBeVisible();
    expect(await screen.findByText('Accessible')).toBeVisible();
  });

  it('warns when planting spacing is unrealistic', async () => {
    const user = userEvent.setup();
    const services = await createConfiguredPlanServices();

    renderRoute('/app/plan', services);

    await addTomato(user);
    await addTomato(user);

    await clickMode(user, 'Optimize');

    expect(await screen.findByText('Proposal inbox')).toBeVisible();
    const planHealth = await screen.findByRole('region', {
      name: 'Plan health',
    });
    expect(planHealth).toBeVisible();
    expect(within(planHealth).getByText('Spacing')).toBeVisible();
    expect(within(planHealth).getByText('Support')).toBeVisible();
    await user.click(within(planHealth).getByText('Spacing'));
    expect(within(planHealth).getByText('Spacing collision')).toBeVisible();
    await user.click(within(planHealth).getByText('Support'));
    expect(
      await within(planHealth).findAllByText('Tomato support missing'),
    ).not.toHaveLength(0);
  });

  it('accepts and rejects review proposals from the Plan inbox', async () => {
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
      climateProfile: {
        ...annArborClimateProfile,
        source: 'user',
      },
      plantings: [
        {
          ...createDefaultPlanting({
            id: 'planting-1',
            label: 'Saved tomato',
            xFt: 2,
            yFt: 3,
          }),
          cropId: 'tomato',
          spacingInches: 24,
          weeklyWaterNeedInches: 1,
        },
        {
          ...createDefaultPlanting({
            id: 'planting-2',
            label: 'Saved tomato 2',
            xFt: 2.25,
            yFt: 3,
          }),
          cropId: 'tomato',
          spacingInches: 24,
          weeklyWaterNeedInches: 1,
        },
      ],
    });

    renderRoute('/app/plan', services);

    await clickMode(user, 'Optimize');

    expect(await screen.findByText('Proposal inbox')).toBeVisible();

    const acceptButtons = await screen.findAllByRole('button', {
      name: 'Accept',
    });
    const acceptButton = acceptButtons[0];

    if (!acceptButton) {
      throw new Error('Expected an accept button in the Review inbox.');
    }

    await user.click(acceptButton);

    const rejectButtons = await screen.findAllByRole('button', {
      name: 'Reject',
    });
    const rejectButton = rejectButtons[0];

    if (!rejectButton) {
      throw new Error('Expected a reject button in the Review inbox.');
    }

    await user.click(rejectButton);

    await user.click(screen.getByRole('button', { name: 'Publish' }));
    const publishDialog = await screen.findByRole('dialog', {
      name: 'Publish draft',
    });

    expect(
      within(publishDialog).getByRole('heading', {
        name: 'Accepted into this draft',
      }),
    ).toBeVisible();
    expect(
      within(publishDialog).getByRole('heading', {
        name: 'Rejected or snoozed',
      }),
    ).toBeVisible();
    expect(within(publishDialog).getByText('accepted')).toBeVisible();
    expect(within(publishDialog).getByText('rejected')).toBeVisible();
  });

  it('recalculates and manually overrides the sun layer', async () => {
    const user = userEvent.setup();
    const services = await createConfiguredPlanServices();

    renderRoute('/app/plan', services);

    await clickMode(user, 'Sun/Climate');
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
    const services = await createConfiguredPlanServices();

    renderRoute('/app/plan', services);

    await addTomato(user);
    await clickMode(user, 'Optimize');
    await user.click(screen.getByRole('button', { name: 'Update weather' }));

    expect(await screen.findByText(/Sunny/)).toBeVisible();
    expect(await screen.findAllByText(/Tomato:/)).not.toHaveLength(0);
    expect(await screen.findAllByText(/Heat stress/)).not.toHaveLength(0);
  });

  it('resizes the plot, clamps plants, and keeps changes unsaved', async () => {
    const user = userEvent.setup();
    const services = await createConfiguredPlanServices();

    renderRoute('/app/plan', services);

    await addTomato(user);
    await user.click(screen.getByRole('button', { name: 'Plot settings' }));
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
    expect(await screen.findByText('X 4.0 ft, Y 3.0 ft')).toBeVisible();
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

    renderRoute('/app/plan', services);

    await user.click(
      await screen.findByRole('button', {
        name: 'Saved tomato at X: 2.5 ft, Y: 3.0 ft',
      }),
    );

    const focusCard = await screen.findByRole('complementary', {
      name: 'Crop focus',
    });
    expect(within(focusCard).getByText('X 2.5 ft, Y 3.0 ft')).toBeVisible();
    expect(
      screen.queryByRole('button', { name: 'Save' }),
    ).not.toBeInTheDocument();
  });

  it('renders arrangement plantings as individual selectable nodes', async () => {
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
        withPlantingInstances({
          ...createDefaultPlanting({
            id: 'carrot-row',
            label: 'Carrot',
            xFt: 4,
            yFt: 3,
          }),
          cropId: 'carrot',
          mode: 'row',
          plantCount: 3,
          rowLengthFt: 4,
          spacingInches: 24,
        }),
      ],
    });

    renderRoute('/app/plan', services);

    expect(
      await screen.findByRole('button', {
        name: 'Carrot 1 at X: 2.0 ft, Y: 3.0 ft',
      }),
    ).toBeVisible();
    const middleCarrot = await screen.findByRole('button', {
      name: 'Carrot 2 at X: 4.0 ft, Y: 3.0 ft',
    });
    expect(
      screen.getByRole('button', {
        name: 'Carrot 3 at X: 6.0 ft, Y: 3.0 ft',
      }),
    ).toBeVisible();

    await user.click(middleCarrot);

    expect(await screen.findByText('X 4.0 ft, Y 3.0 ft')).toBeVisible();
    await openFocusedPlantInspector(user);

    const spacingInput = await screen.findByRole('spinbutton', {
      name: 'Plant spacing in feet value',
    });
    fireEvent.change(spacingInput, { target: { value: '1' } });

    expect(
      await screen.findByRole('button', {
        name: 'Carrot 1 at X: 3.0 ft, Y: 3.0 ft',
      }),
    ).toBeVisible();
    expect(
      screen.getByRole('button', {
        name: 'Carrot 2 at X: 4.0 ft, Y: 3.0 ft',
      }),
    ).toBeVisible();
    expect(
      screen.getByRole('button', {
        name: 'Carrot 3 at X: 5.0 ft, Y: 3.0 ft',
      }),
    ).toBeVisible();
  });
});

async function addTomato(user: ReturnType<typeof userEvent.setup>) {
  await clickMode(user, 'Plant');
  await user.click(
    await screen.findByRole('button', { name: 'Open plant picker' }),
  );
  const search = await screen.findByRole('searchbox', {
    name: 'Search crops',
  });

  await user.clear(search);
  await user.type(search, 'tomato');
  await user.click(await screen.findByRole('button', { name: 'Tomato crop' }));
  await user.click(screen.getByRole('button', { name: 'Add plant' }));
}

async function clickMode(
  user: ReturnType<typeof userEvent.setup>,
  name: string,
) {
  const rail = await screen.findByRole('complementary', {
    name: 'Plan tools',
  });
  await user.click(
    await within(rail).findByRole('button', { name: 'Open Plan tools' }),
  );
  const button = await within(rail).findByRole('button', { name });

  if (!button) {
    throw new Error(`Expected ${name} mode button.`);
  }

  await user.click(button);
}

async function openFocusedPlantInspector(
  user: ReturnType<typeof userEvent.setup>,
) {
  const focusCard = await screen.findByRole('complementary', {
    name: 'Crop focus',
  });

  await user.click(
    within(focusCard).getByRole('button', { name: /Open details/ }),
  );
  await screen.findByRole('complementary', {
    name: 'Selected item inspector',
  });
}

async function createConfiguredPlanServices() {
  const services = await createTestServices({
    signedInEmail: 'primary.gardener@example.com',
  });
  const currentUser = services.authService.getCurrentUser();

  if (!currentUser) {
    throw new Error('Expected signed-in test user.');
  }

  await services.gardenRepository.saveGarden({
    ...createDefaultGarden(currentUser.uid),
    climateProfile: {
      ...annArborClimateProfile,
      source: 'user',
    },
  });

  return services;
}
