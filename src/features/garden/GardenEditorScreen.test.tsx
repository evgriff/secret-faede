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
    expect(screen.getByRole('tooltip', { name: 'Tomato' })).toBeVisible();
    expect(within(tomatoNode).getByText('Needs cage')).toBeVisible();
    const focusCard = await screen.findByRole('complementary', {
      name: 'Crop focus',
    });
    expect(within(focusCard).getByText('X 6.0 ft, Y 4.0 ft')).toBeVisible();
    await user.click(within(focusCard).getByRole('tab', { name: 'Crop' }));
    expect(within(focusCard).getByText('1 plant')).toBeVisible();
    await user.click(within(focusCard).getByRole('tab', { name: 'Needs' }));
    expect(within(focusCard).getByText(/Cage required/)).toBeVisible();
    expect(screen.getByRole('button', { name: 'Save' })).toBeVisible();
  });

  it('supports planting duplicate, lifecycle, lock, and delete flows', async () => {
    const user = userEvent.setup();
    const services = await createConfiguredPlanServices();

    renderRoute('/app/plan', services);

    await addTomato(user);
    await openFocusedPlantEditor(user);
    await user.click(screen.getByRole('button', { name: 'Duplicate' }));

    expect(
      await screen.findByRole('button', {
        name: 'Tomato copy at X: 6.5 ft, Y: 4.5 ft',
      }),
    ).toBeVisible();

    await user.selectOptions(
      screen.getByLabelText('Lifecycle'),
      'harvest-ready',
    );

    const anchoredNode = await screen.findByRole('button', {
      name: 'Tomato copy at X: 6.5 ft, Y: 4.5 ft',
    });

    expect(screen.getByRole('tooltip', { name: 'Tomato copy' })).toBeVisible();
    expect(within(anchoredNode).getByText('Anchored')).toBeVisible();
    expect(screen.getByLabelText('Lifecycle')).toHaveValue('harvest-ready');
    expect(await screen.findByText('Anchored in real garden')).toBeVisible();

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
      screen.queryByRole('dialog', {
        name: /Edit Tomato copy/,
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
      name: 'Add Plants',
    });

    if (!choosePlantsButton) {
      throw new Error('Expected Add Plants action.');
    }

    await user.click(choosePlantsButton);
    expect(
      await screen.findByRole('dialog', { name: 'Choose Plants' }),
    ).toBeVisible();
    expect(screen.getByRole('combobox', { name: 'Lifecycle' })).toBeVisible();
    expect(
      screen.getByRole('combobox', { name: 'Location Match' }),
    ).toBeVisible();

    await user.clear(screen.getByRole('searchbox', { name: 'Search plants' }));
    await user.type(
      screen.getByRole('searchbox', { name: 'Search plants' }),
      'tomato',
    );

    const library = screen.getByRole('region', { name: 'Plant library' });
    expect(within(library).getAllByText(/Location Match:/)[0]).toBeVisible();
    expect(
      within(library).getAllByText(/Annual - Continuous harvest/)[0],
    ).toBeVisible();
    expect(within(library).queryByText('Spacing')).not.toBeInTheDocument();
    await user.click(
      await within(library).findByRole('button', {
        name: 'Show Tomato details',
      }),
    );
    expect((await within(library).findAllByText('Spacing'))[0]).toBeVisible();
    expect(within(library).getAllByText('Lifecycle')[0]).toBeVisible();
    expect(
      within(library).getByText(/zone 6a; average last frost/i),
    ).toBeVisible();
    await user.click(
      within(library).getByRole('button', { name: 'Hide Tomato details' }),
    );

    await user.click(await screen.findByRole('button', { name: 'Add Tomato' }));

    const board = screen.getByRole('region', { name: 'Season crop board' });

    expect(within(board).getByText('Tomato')).toBeVisible();
    expect(within(board).getByLabelText('Tomato quantity')).toHaveValue(1);
    expect(within(board).getByText('Single form')).toBeVisible();
    expect(within(board).getByText('2 x 2 ft · 4 sq ft')).toBeVisible();
    expect(within(board).getByText('Full')).toBeVisible();
    expect(within(board).getByText('High')).toBeVisible();
    expect(within(board).getByText('Cage')).toBeVisible();
    expect(
      within(board).getByRole('button', { name: 'Tomato review reason' }),
    ).toBeVisible();
    expect(within(board).queryByText('Watch timing')).not.toBeInTheDocument();
    expect(
      within(board).queryByText(/Continuous harvest/),
    ).not.toBeInTheDocument();
    expect(within(board).queryByLabelText('Need')).not.toBeInTheDocument();
    expect(within(board).queryByLabelText('Priority')).not.toBeInTheDocument();
    expect(
      within(board).queryByLabelText('Tomato spacing override in inches'),
    ).not.toBeInTheDocument();
    await user.click(
      within(board).getByRole('button', { name: 'Show Tomato details' }),
    );
    expect(
      within(board).getByRole('button', { name: 'Hide Tomato details' }),
    ).toBeVisible();
    expect(
      within(board).getByLabelText('Tomato spacing override in inches'),
    ).toBeVisible();
    expect(
      within(board).getByLabelText('Tomato spacing override in inches'),
    ).toHaveValue(null);
    expect(within(board).getByText('Planting form')).toBeVisible();
    expect(within(board).getByText('Variety')).toBeVisible();
    expect(within(board).getByText('Notes')).toBeVisible();
    expect(
      within(board).getByRole('region', {
        name: 'Tomato footprint preview',
      }),
    ).toBeVisible();
    expect(within(board).getByText(/Continuous harvest/)).toBeVisible();
    const reviewButton = within(board).queryByRole('button', {
      name: 'Tomato review reason',
    });

    if (reviewButton) {
      await user.click(reviewButton);
      expect(await screen.findByRole('tooltip')).toHaveTextContent(
        /Climate\/season|Space|Sun|Support|partial/i,
      );
      fireEvent.blur(reviewButton);
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    }

    fireEvent.change(within(board).getByLabelText('Tomato quantity'), {
      target: { value: '3' },
    });
    await user.click(screen.getByRole('button', { name: 'Save + Optimize' }));

    expect(screen.getByRole('button', { name: 'Save' })).toBeVisible();

    expect(await screen.findByText(/1 crop request/)).toBeVisible();
    expect(await screen.findByText(/Tomato 3 target/)).toBeVisible();
    expect(screen.queryByText(/\d+\/100/)).not.toBeInTheDocument();
  }, 15_000);

  it('adds multiple plants as one grouped footprint from the quantity-first picker', async () => {
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

    expect(
      screen.getByText(/Will place 3 plants as one group\./),
    ).toBeVisible();
    expect(
      await screen.findByRole('img', {
        name: /Preview Carrot group, 3 plants at X:/,
      }),
    ).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Add plant' }));

    expect(
      await screen.findByRole('button', {
        name: /Carrot group, 3 plants at X:/,
      }),
    ).toBeVisible();
    expect(
      screen.queryByRole('button', { name: /Carrot 1 at X:/ }),
    ).not.toBeInTheDocument();
  });

  it('edits practical plant details and reflects group changes on the plan', async () => {
    const user = userEvent.setup();
    const services = await createConfiguredPlanServices();

    renderRoute('/app/plan', services);

    await addTomato(user);
    await openFocusedPlantEditor(user);

    const editor = await screen.findByRole('dialog', { name: /Edit Tomato/ });

    expect(within(editor).getByText('Care log')).toBeVisible();
    await user.click(within(editor).getByLabelText('Watered'));
    expect(within(editor).getAllByText('Watered')).toHaveLength(2);

    fireEvent.change(within(editor).getByLabelText('How many plants?'), {
      target: { value: '3' },
    });
    expect(
      await screen.findByRole('button', {
        name: 'Tomato group, 3 plants at X: 6.0 ft, Y: 4.0 ft',
      }),
    ).toBeVisible();
    expect(document.querySelectorAll('[data-plant-dot="true"]')).toHaveLength(
      3,
    );

    await user.click(within(editor).getByText('Spacing override'));
    fireEvent.change(
      within(editor).getByLabelText('Spacing override in inches'),
      {
        target: { value: '18' },
      },
    );
    await user.click(within(editor).getByText('Sun, footprint, and warnings'));
    expect(within(editor).getByText('18 in')).toBeVisible();

    await user.selectOptions(
      within(editor).getByLabelText('Support type'),
      'stakeAndWeave',
    );
    expect(within(editor).getByText('Stake and weave planned')).toBeVisible();
    expect(
      within(editor).queryByText(/no support assigned/i),
    ).not.toBeInTheDocument();
    await user.click(within(editor).getByLabelText('Installed'));
    expect(within(editor).getByText('Stake and weave installed')).toBeVisible();

    await user.click(within(editor).getByText('Picture metadata'));
    await user.click(
      within(editor).getByRole('button', { name: 'Reserve picture slot' }),
    );
    fireEvent.change(within(editor).getByLabelText('Picture label'), {
      target: { value: 'Tomato transplant photo' },
    });
    expect(
      within(editor).getByDisplayValue('Tomato transplant photo'),
    ).toBeVisible();
  });

  it('clears the seasonal crop board from Choose Plants', async () => {
    const user = userEvent.setup();
    const services = await createConfiguredPlanServices();

    renderRoute('/app/plan', services);

    const [choosePlantsButton] = await screen.findAllByRole('button', {
      name: 'Add Plants',
    });

    if (!choosePlantsButton) {
      throw new Error('Expected Add Plants action.');
    }

    await user.click(choosePlantsButton);
    await user.type(
      screen.getByRole('searchbox', { name: 'Search plants' }),
      'tomato',
    );
    await user.click(await screen.findByRole('button', { name: 'Add Tomato' }));

    const board = screen.getByRole('region', { name: 'Season crop board' });
    expect(within(board).getByText('Tomato')).toBeVisible();
    expect(
      within(board).queryByRole('region', {
        name: 'Tomato footprint preview',
      }),
    ).not.toBeInTheDocument();
    expect(within(board).getByText('2 x 2 ft · 4 sq ft')).toBeVisible();
    fireEvent.change(within(board).getByLabelText('Tomato quantity'), {
      target: { value: '3' },
    });
    expect(within(board).getByText('Trellis form')).toBeVisible();
    expect(within(board).getByText('6 ft line · 18 sq ft')).toBeVisible();
    await user.click(
      within(board).getByRole('button', {
        name: 'Show Tomato details',
      }),
    );
    expect(
      within(board).getByRole('region', {
        name: 'Tomato footprint preview',
      }),
    ).toBeVisible();
    await user.selectOptions(
      within(board).getByRole('combobox', { name: 'Planting form' }),
      'row',
    );
    expect(within(board).getByText('Row form')).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Clear list' }));

    expect(within(board).getByText('No plants selected.')).toBeVisible();
    expect(
      screen.getByRole('button', { name: 'Save + Optimize' }),
    ).toBeDisabled();
  });

  it('compares a small set of practical crop facts from Choose Plants', async () => {
    const user = userEvent.setup();
    const services = await createConfiguredPlanServices();

    renderRoute('/app/plan', services);

    const [choosePlantsButton] = await screen.findAllByRole('button', {
      name: 'Add Plants',
    });

    if (!choosePlantsButton) {
      throw new Error('Expected Add Plants action.');
    }

    await user.click(choosePlantsButton);
    await screen.findByRole('dialog', { name: 'Choose Plants' });
    const searchBox = await screen.findByRole('searchbox', {
      name: 'Search plants',
    });

    await user.type(searchBox, 'tomato');
    await user.clear(await screen.findByLabelText('Tomato quantity'));
    await user.type(screen.getByLabelText('Tomato quantity'), '3');
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
    expect(within(comparePanel).getByText('Quick facts')).toBeVisible();
    expect(
      within(comparePanel).getByLabelText(/Space: 3 plants - .* sq ft/),
    ).toBeVisible();
    expect(within(comparePanel).getAllByLabelText(/^Difficulty:/)).toHaveLength(
      2,
    );
    expect(
      within(comparePanel).getAllByLabelText(/^Location Match:/),
    ).toHaveLength(2);
    expect(within(comparePanel).getAllByLabelText(/^Support:/)).toHaveLength(2);
    expect(within(comparePanel).getAllByLabelText(/^Lifecycle:/)).toHaveLength(
      2,
    );
    expect(within(comparePanel).getAllByLabelText(/^Harvest:/)).toHaveLength(2);
    expect(
      within(comparePanel).queryByText(/Best planning match|Harder than/),
    ).not.toBeInTheDocument();

    await user.click(
      within(comparePanel).getByRole('button', { name: 'Clear compare' }),
    );

    expect(
      within(comparePanel).getByText(
        /compare difficulty, space, match, support, and harvest timing/,
      ),
    ).toBeVisible();
  });

  it('searches specific generated crops from the full plant library', async () => {
    const user = userEvent.setup();
    const services = await createConfiguredPlanServices();

    renderRoute('/app/plan', services);

    const [choosePlantsButton] = await screen.findAllByRole('button', {
      name: 'Add Plants',
    });

    if (!choosePlantsButton) {
      throw new Error('Expected Add Plants action.');
    }

    await user.click(choosePlantsButton);
    await user.selectOptions(
      await screen.findByRole('combobox', { name: 'Lifecycle' }),
      'perennial',
    );
    await user.type(
      screen.getByRole('searchbox', { name: 'Search plants' }),
      'rosemary',
    );

    const perennialRosemaryButtons = await screen.findAllByRole('button', {
      name: /Add .*Rosemary/,
    });
    expect(perennialRosemaryButtons[0]).toBeVisible();
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Lifecycle' }),
      'annual',
    );
    expect(await screen.findByText('No matching plants.')).toBeVisible();
    await user.clear(screen.getByRole('searchbox', { name: 'Search plants' }));
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Lifecycle' }),
      'perennial',
    );
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Location Match' }),
      'poor',
    );
    await user.type(
      screen.getByRole('searchbox', { name: 'Search plants' }),
      'rosemary',
    );

    const poorMatchRosemaryButtons = await screen.findAllByRole('button', {
      name: /Add .*Rosemary/,
    });
    expect(poorMatchRosemaryButtons[0]).toBeVisible();
    await user.clear(screen.getByRole('searchbox', { name: 'Search plants' }));
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Lifecycle' }),
      'any',
    );
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Location Match' }),
      'any',
    );
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
      name: 'Plot structure type',
    });
    expect(
      screen.queryByRole('option', { name: 'Legacy shade source' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('option', { name: 'Fence/wall' }),
    ).not.toBeInTheDocument();
    await user.selectOptions(supportTypeSelect, 'trellis');
    await user.click(screen.getByRole('button', { name: 'Place structure' }));

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
      await screen.findByRole('combobox', { name: 'Plot structure type' }),
      'pathway',
    );
    await user.click(screen.getByLabelText('Accessible path defaults'));
    await user.click(screen.getByRole('button', { name: 'Place structure' }));

    expect(
      await screen.findByRole('button', {
        name: 'Pathway, walkable width 4.0 ft, at X: 1.0 ft, Y: 0.0 ft',
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

    await clickPrimaryPlanAction(user, 'Optimize');

    expect(await screen.findByText('Problem inbox')).toBeVisible();
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

  it('applies and ignores problem resolutions from the Plan inbox', async () => {
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

    await clickPrimaryPlanAction(user, 'Optimize');

    expect(await screen.findByText('Problem inbox')).toBeVisible();

    const applyButtons = await screen.findAllByRole('button', {
      name: 'Apply complete resolution',
    });
    const applyButton = applyButtons[0];

    if (!applyButton) {
      throw new Error('Expected an apply button in the Problem inbox.');
    }

    await user.click(applyButton);

    const ignoreButtons = await screen.findAllByRole('button', {
      name: 'Ignore problem',
    });
    const ignoreButton = ignoreButtons[0];

    if (!ignoreButton) {
      throw new Error('Expected an ignore button in the Problem inbox.');
    }

    await user.click(ignoreButton);

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
        name: 'Ignored or rejected',
      }),
    ).toBeVisible();
    expect(within(publishDialog).getByText('accepted')).toBeVisible();
    expect(within(publishDialog).getByText('ignored')).toBeVisible();
  });

  it('recalculates and manually overrides the sun layer', async () => {
    const user = userEvent.setup();
    const services = await createConfiguredPlanServices();

    renderRoute('/app/plan', services);

    await clickPrimaryPlanAction(user, 'Sun');
    await user.click(
      await screen.findByRole('button', { name: 'Recalculate sun' }),
    );
    const sunLayerToggle = screen.getByLabelText('Sun layer');

    if (sunLayerToggle instanceof HTMLInputElement && !sunLayerToggle.checked) {
      await user.click(sunLayerToggle);
    }

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
    await clickPrimaryPlanAction(user, 'Optimize');
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

  it('renders arrangement plantings as one grouped selectable footprint', async () => {
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

    const carrotGroup = await screen.findByRole('button', {
      name: 'Carrot group, 3 plants at X: 4.0 ft, Y: 3.0 ft',
    });

    expect(carrotGroup).toBeVisible();
    expect(screen.getByLabelText('Edit Carrot group')).toBeVisible();
    expect(document.querySelectorAll('[data-plant-dot="true"]')).toHaveLength(
      3,
    );

    await user.click(carrotGroup);

    expect(
      screen.getByRole('tooltip', { name: 'Carrot, 3 plants' }),
    ).toBeVisible();
    expect(await screen.findByText('X 4.0 ft, Y 3.0 ft')).toBeVisible();
    expect(
      screen.queryByRole('complementary', {
        name: 'Selected item inspector',
      }),
    ).not.toBeInTheDocument();

    await user.click(screen.getByLabelText('Edit Carrot group'));
    expect(
      await screen.findByRole('dialog', {
        name: /Edit Carrot/,
      }),
    ).toBeVisible();

    await user.click(screen.getByTestId('plant-editor-backdrop'));
    expect(
      screen.queryByRole('dialog', {
        name: /Edit Carrot/,
      }),
    ).not.toBeInTheDocument();

    await user.click(carrotGroup);
    await openFocusedPlantEditor(user);

    const spacingInput = await screen.findByRole('spinbutton', {
      name: 'Plant spacing in feet value',
    });
    fireEvent.change(spacingInput, { target: { value: '1' } });

    expect(
      await screen.findByRole('button', {
        name: 'Carrot group, 3 plants at X: 4.0 ft, Y: 3.0 ft',
      }),
    ).toBeVisible();
    expect(
      screen.queryByRole('button', { name: /Carrot 1 at X:/ }),
    ).not.toBeInTheDocument();
  });

  it('keeps the plant editor synced while Detailed View is enabled', async () => {
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
            id: 'tomato-group',
            label: 'Tomato',
            xFt: 2,
            yFt: 3,
          }),
          cropId: 'tomato',
          mode: 'single',
          plantCount: 1,
        }),
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

    const tomatoGroup = await screen.findByRole('button', {
      name: 'Tomato at X: 2.0 ft, Y: 3.0 ft',
    });
    const carrotGroup = await screen.findByRole('button', {
      name: 'Carrot group, 3 plants at X: 4.0 ft, Y: 3.0 ft',
    });

    await user.click(tomatoGroup);
    await clickPrimaryPlanAction(user, /Detailed View/);

    expect(
      await screen.findByRole('dialog', { name: /Edit Tomato/ }),
    ).toBeVisible();
    expect(screen.getByTestId('plant-editor-layer')).toBeVisible();
    expect(
      screen.queryByTestId('plant-editor-backdrop'),
    ).not.toBeInTheDocument();

    await user.click(carrotGroup);

    expect(
      await screen.findByRole('dialog', { name: /Edit Carrot/ }),
    ).toBeVisible();
    expect(
      screen.queryByRole('dialog', { name: /Edit Tomato/ }),
    ).not.toBeInTheDocument();

    await user.click(screen.getByTestId('garden-plot'));
    expect(screen.getByRole('dialog', { name: /Edit Carrot/ })).toBeVisible();

    await user.keyboard('{Escape}');
    expect(
      screen.queryByRole('dialog', { name: /Edit Carrot/ }),
    ).not.toBeInTheDocument();
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
    name: 'Build tools',
  });
  await user.click(
    await within(rail).findByRole('button', { name: 'Open build tools' }),
  );
  const button = await within(rail).findByRole('button', { name });

  if (!button) {
    throw new Error(`Expected ${name} mode button.`);
  }

  await user.click(button);
}

async function clickPrimaryPlanAction(
  user: ReturnType<typeof userEvent.setup>,
  name: RegExp | string,
) {
  const primaryActions = await screen.findByRole('navigation', {
    name: 'Primary plan actions',
  });
  await user.click(await within(primaryActions).findByRole('button', { name }));
}

async function openFocusedPlantEditor(
  user: ReturnType<typeof userEvent.setup>,
) {
  const focusCard = await screen.findByRole('complementary', {
    name: 'Crop focus',
  });

  await user.click(
    within(focusCard).getByRole('button', { name: /Open details/ }),
  );
  await screen.findByRole('dialog', {
    name: /Edit /,
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
