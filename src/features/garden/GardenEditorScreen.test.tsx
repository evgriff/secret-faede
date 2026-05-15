import {
  fireEvent,
  screen,
  waitFor,
  waitForElementToBeRemoved,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, vi } from 'vitest';

import {
  detroitClimateProfile,
  createDefaultGarden,
  createDefaultPlanting,
  createDefaultStructure,
} from '../../domain/gardens/GardenRepository';
import { withPlantingInstances } from '../../domain/gardens/plantingInstances';
import { formatDateForTimeZone } from '../plan/planDates';
import { renderRoute } from '../../test/render';
import { createTestServices } from '../../test/testServices';

describe('PlanPage', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('launches first-run setup and creates a blank plan', async () => {
    const user = userEvent.setup();
    const services = await createTestServices({
      signedInEmail: 'primary.gardener@example.com',
    });

    renderRoute('/app/plan', services);

    const setupLoading = screen.queryByRole('heading', {
      name: 'Preparing garden setup',
    });

    if (setupLoading) {
      await waitForElementToBeRemoved(setupLoading, { timeout: 20_000 });
    }

    expect(
      await screen.findByRole(
        'heading',
        { name: 'Set up your garden' },
        { timeout: 20_000 },
      ),
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
    expect(screen.getByDisplayValue('6b')).toBeVisible();

    await user.click(screen.getByLabelText(/Blank plan/));
    await user.click(screen.getByRole('button', { name: 'Create plan' }));

    expect(await screen.findByRole('heading', { name: 'Plan' })).toBeVisible();
    expect(await screen.findByText('12 ft by 8 ft')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Save' })).toBeVisible();
  }, 60_000);

  it('loads a default real-world plot without dirty save controls', async () => {
    const services = await createConfiguredPlanServices();

    renderRoute('/app/plan', services);

    expect(await screen.findByRole('heading', { name: 'Plan' })).toBeVisible();
    expect(await screen.findByText('12 ft by 8 ft')).toBeVisible();
    expect(
      screen.queryByRole('button', { name: 'More plan actions' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Save' }),
    ).not.toBeInTheDocument();
  });

  it('does not treat saved draft metadata as plot changes on load', async () => {
    const services = await createConfiguredPlanServices();
    const currentUser = services.authService.getCurrentUser();

    if (!currentUser) {
      throw new Error('Expected signed-in test user.');
    }

    const workspace = await services.gardenRepository.getWorkspace(
      currentUser.uid,
    );

    await services.gardenRepository.saveDraft({
      ...workspace.draft,
      suggestionDecisions: [
        {
          decidedAtIso: '2026-04-24T16:00:00.000Z',
          id: 'review:ignored',
          impact: 'planned',
          label: 'Ignore review note',
          note: 'Metadata only',
          status: 'snoozed',
        },
      ],
    });

    renderRoute('/app/plan', services);

    expect(await screen.findByRole('heading', { name: 'Plan' })).toBeVisible();
    expect(screen.getByText('Published', { exact: true })).toBeVisible();
    expect(
      screen.queryByRole('button', { name: 'More plan actions' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Save' }),
    ).not.toBeInTheDocument();
  });

  it('exposes abandon draft only for actual saved plot edits', async () => {
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
        ...detroitClimateProfile,
        source: 'user',
      },
      structures: [
        {
          ...createDefaultStructure({
            id: 'structure-trellis',
            type: 'trellis',
            xFt: 1,
            yFt: 1,
          }),
          depthFt: 0.5,
          label: 'Saved trellis',
          widthFt: 8,
        },
      ],
    });

    renderRoute('/app/plan', services);

    const moreActions = await screen.findByRole('button', {
      name: 'More plan actions',
    });
    expect(moreActions).toBeVisible();
    expect(
      screen.queryByRole('button', { name: 'Sync from published' }),
    ).not.toBeInTheDocument();

    await user.click(moreActions);
    await user.click(screen.getByRole('menuitem', { name: 'Abandon draft' }));

    expect(
      screen.queryByRole('button', {
        name: 'Saved trellis at X: 1.0 ft, Y: 1.0 ft',
      }),
    ).not.toBeInTheDocument();
    expect(
      await screen.findByRole('heading', { name: 'Set up your garden' }),
    ).toBeVisible();
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
    expect(
      screen.queryByRole('complementary', { name: 'Crop focus' }),
    ).not.toBeInTheDocument();

    await user.click(screen.getByLabelText('Edit Tomato group'));
    const editor = await screen.findByRole('dialog', { name: /Edit Tomato/ });

    expect(within(editor).getByLabelText('How many plants?')).toHaveValue(1);
    expect(within(editor).getByText('Needs water check')).toBeVisible();
    expect(
      within(editor).getByRole('heading', { name: 'Supports' }),
    ).toBeVisible();
    await user.click(within(editor).getByText('Sun, footprint, and warnings'));
    expect(within(editor).getByText('X 6.0 ft, Y 4.0 ft')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Save' })).toBeVisible();
  }, 30_000);

  it('captures plot wheel zoom before the browser can zoom the page', async () => {
    const user = userEvent.setup();
    const services = await createConfiguredPlanServices();

    renderRoute('/app/plan', services);

    const viewport = await screen.findByTestId('plot-viewport');
    const plot = await screen.findByTestId('garden-plot');

    mockElementRect(viewport, { height: 512, width: 768 });
    mockElementRect(plot, { height: 256, left: 64, top: 64, width: 384 });

    await user.click(screen.getByRole('button', { name: '100%' }));
    expect(screen.getByLabelText('Current zoom')).toHaveTextContent('100%');

    const wheelEvent = new WheelEvent('wheel', {
      bubbles: true,
      cancelable: true,
      clientX: 240,
      clientY: 180,
      ctrlKey: true,
      deltaY: -240,
    });

    viewport.dispatchEvent(wheelEvent);

    expect(wheelEvent.defaultPrevented).toBe(true);
    await waitFor(() => {
      expect(screen.getByLabelText('Current zoom')).not.toHaveTextContent(
        '100%',
      );
    });
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
  }, 30_000);

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
  }, 30_000);

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
        ...detroitClimateProfile,
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
    await user.keyboard('[ShiftLeft>]');
    await user.click(
      await screen.findByRole('button', {
        name: 'Saved basil at X: 4.0 ft, Y: 3.0 ft',
      }),
    );
    await user.keyboard('[/ShiftLeft]');

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
    await user.keyboard('[ShiftLeft>]');
    await user.click(
      await screen.findByRole('button', {
        name: 'Saved basil at X: 4.1 ft, Y: 3.0 ft',
      }),
    );
    await user.keyboard('[/ShiftLeft]');
    expect(await screen.findByText('2 selected')).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Duplicate' }));

    expect(
      await screen.findByRole('button', {
        name: 'Saved tomato copy at X: 2.6 ft, Y: 3.5 ft',
      }),
    ).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Delete' }));

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

  it('marks multiple selected plant groups as planted with one shared date', async () => {
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
        ...detroitClimateProfile,
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
    const expectedDate = formatDateForTimeZone(new Date(), 'America/Detroit');

    await user.click(
      await screen.findByRole('button', {
        name: 'Saved tomato at X: 2.0 ft, Y: 3.0 ft',
      }),
    );
    await user.keyboard('[ShiftLeft>]');
    await user.click(
      await screen.findByRole('button', {
        name: 'Saved basil at X: 4.0 ft, Y: 3.0 ft',
      }),
    );
    await user.keyboard('[/ShiftLeft]');

    await user.click(
      screen.getByRole('button', { name: 'Mark selected as planted' }),
    );

    expect(
      screen.getByText(
        'Applies one planted date to all 2 selected plant groups.',
      ),
    ).toBeVisible();
    expect(screen.getByLabelText('Planted on')).toHaveValue(expectedDate);

    await user.click(
      screen.getByRole('button', { name: 'Apply planted date' }),
    );

    const plantedTomato = await screen.findByRole('button', {
      name: 'Saved tomato at X: 2.0 ft, Y: 3.0 ft',
    });
    const plantedBasil = await screen.findByRole('button', {
      name: 'Saved basil at X: 4.0 ft, Y: 3.0 ft',
    });

    expect(plantedTomato).toHaveTextContent('Anchored');
    expect(plantedBasil).toHaveTextContent('Anchored');

    await user.click(plantedTomato);
    await openFocusedPlantEditor(user);

    expect(screen.getByLabelText('Lifecycle')).toHaveValue('planted');
    expect(screen.getByLabelText('Planted on')).toHaveValue(expectedDate);
    expect(
      within(
        screen.getByRole('list', { name: 'Recent planting events' }),
      ).getByText('Planted out'),
    ).toBeVisible();
  });

  it('records direct-sow events from the plant editor with the chosen date', async () => {
    const user = userEvent.setup();
    const services = await createConfiguredPlanServices();

    renderRoute('/app/plan', services);

    await addTomato(user);

    const tomatoNode = await screen.findByRole('button', {
      name: 'Tomato at X: 6.0 ft, Y: 4.0 ft',
    });

    await user.click(tomatoNode);
    await openFocusedPlantEditor(user);
    fireEvent.change(screen.getByLabelText('Event date'), {
      target: { value: '2026-04-22' },
    });
    await user.click(screen.getByRole('button', { name: 'Direct sowed' }));

    expect(screen.getByLabelText('Lifecycle')).toHaveValue('planted');
    expect(screen.getByLabelText('Planted on')).toHaveValue('2026-04-22');
    expect(
      within(
        screen.getByRole('list', { name: 'Recent planting events' }),
      ).getByText('Direct sowed'),
    ).toBeVisible();
    expect(
      within(
        screen.getByRole('list', { name: 'Recent planting events' }),
      ).getByText('2026-04-22'),
    ).toBeVisible();
    expect(screen.getByText('Planted 2026-04-22')).toBeVisible();
  });

  it('shows structure resize preview before committing the new footprint', async () => {
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
        ...detroitClimateProfile,
        source: 'user',
      },
      structures: [
        {
          ...createDefaultStructure({
            id: 'structure-trellis',
            type: 'trellis',
            xFt: 1,
            yFt: 1,
          }),
          depthFt: 0.5,
          label: 'Saved trellis',
          widthFt: 8,
        },
      ],
    });

    renderRoute('/app/plan', services);

    const plot = await screen.findByTestId('garden-plot');
    const trellis = await screen.findByRole('button', {
      name: 'Saved trellis at X: 1.0 ft, Y: 1.0 ft',
    });

    mockElementRect(plot, { height: 256, width: 384 });
    await user.click(trellis);

    const eastHandle = await screen.findByRole('button', {
      name: 'Resize Saved trellis east handle',
    });
    const initialWidth = Number.parseFloat(trellis.style.width);

    fireEvent.pointerDown(eastHandle, {
      button: 0,
      buttons: 1,
      clientX: 288,
      clientY: 48,
      pointerId: 1,
      pointerType: 'mouse',
    });
    fireEvent.pointerMove(eastHandle, {
      buttons: 1,
      clientX: 320,
      clientY: 48,
      pointerId: 1,
      pointerType: 'mouse',
    });

    await waitFor(() => {
      expect(Number.parseFloat(trellis.style.width)).toBeGreaterThan(
        initialWidth,
      );
    });

    fireEvent.pointerUp(eastHandle, {
      button: 0,
      clientX: 320,
      clientY: 48,
      pointerId: 1,
      pointerType: 'mouse',
    });

    await waitFor(() => {
      expect(Number.parseFloat(trellis.style.width)).toBeGreaterThan(
        initialWidth,
      );
    });
  });

  it('resizes a plant group area and auto-fits the plant count', async () => {
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
        ...detroitClimateProfile,
        source: 'user',
      },
      plantings: [
        {
          ...createDefaultPlanting({
            id: 'planting-lettuce',
            label: 'Saved lettuce',
            xFt: 2,
            yFt: 3,
          }),
          matureSpreadInches: 12,
          spacingInches: 12,
        },
      ],
    });

    renderRoute('/app/plan', services);

    const plot = await screen.findByTestId('garden-plot');
    const plant = await screen.findByRole('button', {
      name: 'Saved lettuce at X: 2.0 ft, Y: 3.0 ft',
    });

    mockElementRect(plot, { height: 256, width: 384 });
    await user.click(plant);

    const resizeHandle = await screen.findByRole('button', {
      name: 'Resize Saved lettuce planting area southeast handle',
    });
    const plantGroup = plant.closest<HTMLElement>('[data-plant-group-id]');

    if (!plantGroup) {
      throw new Error('Expected plant group wrapper.');
    }

    const initialWidth = Number.parseFloat(plantGroup.style.width);

    fireEvent.pointerDown(resizeHandle, {
      button: 0,
      buttons: 1,
      clientX: 80,
      clientY: 96,
      pointerId: 1,
      pointerType: 'mouse',
    });
    fireEvent.pointerMove(resizeHandle, {
      buttons: 1,
      clientX: 160,
      clientY: 160,
      pointerId: 1,
      pointerType: 'mouse',
    });

    await waitFor(() => {
      expect(Number.parseFloat(plantGroup.style.width)).toBeGreaterThan(
        initialWidth,
      );
    });

    fireEvent.pointerUp(resizeHandle, {
      button: 0,
      clientX: 160,
      clientY: 160,
      pointerId: 1,
      pointerType: 'mouse',
    });

    expect(
      await screen.findByRole('button', {
        name: /Saved lettuce group, [2-9][0-9]* plants at X:/,
      }),
    ).toBeVisible();
  });

  it('edits selected plant spacing in the editor and updates the footprint', async () => {
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
        ...detroitClimateProfile,
        source: 'user',
      },
      plantings: [
        {
          ...createDefaultPlanting({
            id: 'planting-pepper',
            label: 'Saved pepper',
            xFt: 4,
            yFt: 4,
          }),
          blockDepthFt: 4,
          blockWidthFt: 4,
          cropId: 'tomato-beefsteak',
          matureSpreadInches: 36,
          mode: 'block',
          plantCount: 4,
          spacingInches: null,
        },
      ],
    });

    renderRoute('/app/plan', services);

    const plant = await screen.findByRole('button', {
      name: /Saved pepper.*X: 4\.0 ft, Y: 4\.0 ft/,
    });

    await user.click(plant);
    expect(
      screen.queryByRole('button', {
        name: 'Adjust Saved pepper spacing',
      }),
    ).not.toBeInTheDocument();
    await user.click(
      await screen.findByRole('button', {
        name: 'Edit Saved pepper group',
      }),
    );

    const editor = await screen.findByRole('dialog', {
      name: /Edit Saved pepper/,
    });
    const spacingInput = within(editor).getByLabelText(
      'Plant spacing in inches',
    );

    await user.clear(spacingInput);
    await user.type(spacingInput, '12');

    expect(
      await screen.findByRole('button', {
        name: /Saved pepper.*X: 4\.0 ft, Y: 4\.0 ft/,
      }),
    ).toBeVisible();
    expect(within(editor).getByText('12 in current')).toBeVisible();
    expect(
      within(editor).getByText(
        'Spacing is tighter than the catalog spacing of 24 in.',
      ),
    ).toBeVisible();
  });

  it('keeps plant surfaces closed during drag and ordinary plant clicks', async () => {
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
        ...detroitClimateProfile,
        source: 'user',
      },
      plantings: [
        createDefaultPlanting({
          id: 'planting-1',
          label: 'Saved tomato',
          xFt: 2,
          yFt: 3,
        }),
      ],
    });

    renderRoute('/app/plan', services);

    const plot = await screen.findByTestId('garden-plot');
    const plant = await screen.findByRole('button', {
      name: 'Saved tomato at X: 2.0 ft, Y: 3.0 ft',
    });

    mockElementRect(plot, { height: 256, width: 384 });
    await user.click(plant);

    expect(
      screen.queryByRole('complementary', { name: 'Crop focus' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('dialog', { name: /Edit Saved tomato/ }),
    ).not.toBeInTheDocument();

    fireEvent.pointerDown(plant, {
      button: 0,
      buttons: 1,
      clientX: 64,
      clientY: 96,
      pointerId: 1,
      pointerType: 'mouse',
    });

    await waitFor(() => {
      expect(
        screen.queryByRole('complementary', { name: 'Crop focus' }),
      ).not.toBeInTheDocument();
    });

    fireEvent.pointerMove(plant, {
      buttons: 1,
      clientX: 96,
      clientY: 128,
      pointerId: 1,
      pointerType: 'mouse',
    });

    expect(
      screen.queryByRole('dialog', { name: /Edit Saved tomato/ }),
    ).not.toBeInTheDocument();

    fireEvent.pointerUp(plant, {
      button: 0,
      clientX: 96,
      clientY: 128,
      pointerId: 1,
      pointerType: 'mouse',
    });

    expect(
      screen.queryByRole('complementary', { name: 'Crop focus' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('dialog', { name: /Edit Saved tomato/ }),
    ).not.toBeInTheDocument();

    const movedPlant = await screen.findByRole('button', {
      name: 'Saved tomato at X: 3.0 ft, Y: 4.0 ft',
    });
    await user.click(movedPlant);

    expect(
      screen.queryByRole('complementary', { name: 'Crop focus' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('dialog', { name: /Edit Saved tomato/ }),
    ).not.toBeInTheDocument();
  });

  it('keeps drag autosave async and waits for the newest position before marking saved', async () => {
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
        ...detroitClimateProfile,
        source: 'user',
      },
      plantings: [
        createDefaultPlanting({
          id: 'planting-1',
          label: 'Saved tomato',
          xFt: 2,
          yFt: 3,
        }),
      ],
    });

    const originalSaveDraft = services.gardenRepository.saveDraft.bind(
      services.gardenRepository,
    );
    const pendingSaves: Array<() => void> = [];

    vi.spyOn(services.gardenRepository, 'saveDraft').mockImplementation(
      (draft) =>
        new Promise<void>((resolve) => {
          pendingSaves.push(() => {
            void originalSaveDraft(draft).then(resolve);
          });
        }),
    );

    renderRoute('/app/plan', services);

    const plot = await screen.findByTestId('garden-plot');
    mockElementRect(plot, { height: 256, width: 384 });

    dragElement(
      await screen.findByRole('button', {
        name: 'Saved tomato at X: 2.0 ft, Y: 3.0 ft',
      }),
      { endX: 96, endY: 128, startX: 64, startY: 96 },
    );

    expect(
      await screen.findByRole('button', {
        name: 'Saved tomato at X: 3.0 ft, Y: 4.0 ft',
      }),
    ).toBeVisible();
    expect(
      screen.queryByRole('complementary', { name: 'Crop focus' }),
    ).not.toBeInTheDocument();
    await waitFor(() => expect(pendingSaves).toHaveLength(1));
    expect(screen.getByText('Saving')).toBeVisible();

    dragElement(
      screen.getByRole('button', {
        name: 'Saved tomato at X: 3.0 ft, Y: 4.0 ft',
      }),
      { endX: 128, endY: 160, startX: 96, startY: 128 },
    );

    expect(
      await screen.findByRole('button', {
        name: 'Saved tomato at X: 4.0 ft, Y: 5.0 ft',
      }),
    ).toBeVisible();

    pendingSaves.shift()?.();

    await waitFor(() => expect(pendingSaves).toHaveLength(1));
    expect(screen.getByText('Saving')).toBeVisible();
    expect(screen.queryByText('Saved')).not.toBeInTheDocument();

    pendingSaves.shift()?.();

    await waitFor(() => expect(screen.getByText('Saved')).toBeVisible());

    const savedGarden = await services.gardenRepository.getGarden(
      currentUser.uid,
    );

    expect(savedGarden?.plantings[0]).toMatchObject({
      xFt: 4,
      yFt: 5,
    });
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
    await user.type(
      screen.getByRole('searchbox', { name: 'Search crops' }),
      'cucumber',
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

    await openChoosePlantsFromTopBar(user);
    expect(
      await screen.findByRole('dialog', { name: 'Choose Plants' }),
    ).toBeVisible();
    expect(screen.getByRole('button', { name: 'More filters' })).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'More filters' }));
    expect(screen.getByRole('combobox', { name: 'Lifecycle' })).toBeVisible();
    expect(screen.getByRole('combobox', { name: 'Plot fit' })).toBeVisible();

    await user.clear(screen.getByRole('searchbox', { name: 'Search plants' }));
    await user.type(
      screen.getByRole('searchbox', { name: 'Search plants' }),
      'tomato',
    );

    const library = screen.getByRole('region', { name: 'Plant library' });
    expect(within(library).getAllByText(/Plot fit:/)[0]).toBeVisible();
    expect(within(library).getAllByText('4 sq ft')[0]).toBeVisible();
    expect(within(library).queryByText('Spacing')).not.toBeInTheDocument();
    await user.click(
      await within(library).findByRole('button', {
        name: 'Show Tomato details',
      }),
    );
    expect((await within(library).findAllByText('Spacing'))[0]).toBeVisible();
    expect(within(library).getAllByText('Lifecycle')[0]).toBeVisible();
    expect(
      within(library).getByText(/zone 6b; average last frost/i),
    ).toBeVisible();
    await user.click(
      within(library).getByRole('button', { name: 'Hide Tomato details' }),
    );

    await user.click(await screen.findByRole('button', { name: 'Add Tomato' }));
    await expandPickedPlantsPanel(user);

    const board = screen.getByRole('region', { name: 'Season crop board' });

    expect(within(board).getByText('Tomato')).toBeVisible();
    expect(within(board).getByLabelText('Tomato quantity')).toHaveValue(1);
    expect(within(board).getByText('2 x 2 ft · 4 sq ft')).toBeVisible();
    expect(within(board).getByText('Full')).toBeVisible();
    expect(within(board).getByText('Cage')).toBeVisible();
    expect(within(board).getByText('Plant now')).toBeVisible();
    expect(
      within(board).queryByRole('button', { name: 'Tomato review reason' }),
    ).not.toBeInTheDocument();
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
    await user.click(
      screen.getByRole('button', { name: 'Save and improve plan' }),
    );

    expect(screen.getByRole('button', { name: 'Save' })).toBeVisible();

    const layoutWalkthrough = await screen.findByRole('region', {
      name: 'Layout suggestion',
    });

    expect(
      await within(layoutWalkthrough).findByText(
        /One checked layout suggestion is ready to review\./i,
      ),
    ).toBeVisible();
    expect(
      within(layoutWalkthrough).getByText(
        /Review this suggestion, then apply it or keep the current layout\./i,
      ),
    ).toBeVisible();
    expect(screen.queryByText(/\d+\/100/)).not.toBeInTheDocument();
  }, 30_000);

  it('merges repeat crop adds in Choose Plants and preserves row edits after save', async () => {
    const user = userEvent.setup();
    const services = await createConfiguredPlanServices();

    renderRoute('/app/plan', services);

    await openChoosePlantsFromTopBar(user);
    await user.type(
      screen.getByRole('searchbox', { name: 'Search plants' }),
      'tomato',
    );

    const library = screen.getByRole('region', { name: 'Plant library' });

    await user.click(
      await within(library).findByRole('button', { name: 'Add Tomato' }),
    );
    expect(
      await within(library).findByRole('button', { name: 'Add more Tomato' }),
    ).toBeEnabled();
    await expandPickedPlantsPanel(user);

    const board = screen.getByRole('region', { name: 'Season crop board' });

    await user.click(
      within(board).getByRole('button', { name: 'Show Tomato details' }),
    );
    await user.type(within(board).getByLabelText('Variety'), 'Sun Gold');
    await user.type(within(board).getByLabelText('Notes'), 'South trellis');

    await user.click(
      within(library).getByRole('button', { name: 'Add more Tomato' }),
    );

    expect(
      within(board).getAllByRole('heading', { name: 'Tomato' }),
    ).toHaveLength(1);
    expect(within(board).getByLabelText('Tomato quantity')).toHaveValue(2);
    expect(within(board).getByText('Row form')).toBeVisible();
    expect(within(board).getByLabelText('Variety')).toHaveValue('Sun Gold');
    expect(within(board).getByLabelText('Notes')).toHaveValue('South trellis');

    await user.click(screen.getByRole('button', { name: 'Save list' }));
    await openChoosePlantsFromTopBar(user);
    await expandPickedPlantsPanel(user);

    const reopenedBoard = screen.getByRole('region', {
      name: 'Season crop board',
    });

    expect(within(reopenedBoard).getByLabelText('Tomato quantity')).toHaveValue(
      2,
    );
    await user.click(
      within(reopenedBoard).getByRole('button', {
        name: 'Show Tomato details',
      }),
    );
    expect(within(reopenedBoard).getByLabelText('Variety')).toHaveValue(
      'Sun Gold',
    );
    expect(within(reopenedBoard).getByLabelText('Notes')).toHaveValue(
      'South trellis',
    );
  }, 30_000);

  it('keeps the picked plants side collapsed until requested on desktop', async () => {
    const user = userEvent.setup();
    const services = await createConfiguredPlanServices();

    renderRoute('/app/plan', services);

    await openChoosePlantsFromTopBar(user);
    await user.type(
      screen.getByRole('searchbox', { name: 'Search plants' }),
      'watermelon',
    );
    await user.click(
      await screen.findByRole('button', { name: 'Add Dwarf Watermelon' }),
    );

    const expandButton = screen.getByRole('button', {
      name: 'Expand picked plants',
    });

    expect(expandButton).toHaveAttribute('aria-expanded', 'false');
    expect(expandButton).toHaveTextContent('1');
    expect(expandButton).toHaveTextContent('1 plant');

    await user.click(expandButton);

    expect(
      screen.getByRole('button', { name: 'Collapse picked side' }),
    ).toHaveAttribute('aria-expanded', 'true');

    const board = screen.getByRole('region', { name: 'Season crop board' });

    expect(
      within(board).getByRole('heading', { name: 'Dwarf Watermelon' }),
    ).toBeVisible();
    expect(
      within(board).getByLabelText('Dwarf Watermelon quantity'),
    ).toHaveValue(1);
    expect(
      within(board).getByRole('button', { name: 'Remove Dwarf Watermelon' }),
    ).toBeVisible();
    expect(
      within(board).getByRole('button', {
        name: 'Show Dwarf Watermelon details',
      }),
    ).toBeVisible();
    expect(within(board).getByText('Review')).toBeVisible();
  }, 30_000);

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
  }, 25_000);

  it('centers Add Plant on location and planting-time fit', async () => {
    const user = userEvent.setup();
    const services = await createConfiguredPlanServices();

    renderRoute('/app/plan', services);

    await clickMode(user, 'Plant');
    await user.click(
      await screen.findByRole('button', { name: 'Open plant picker' }),
    );

    expect(
      screen.getByRole('combobox', { name: /Fits my location/i }),
    ).toBeVisible();
    expect(
      screen.getByRole('combobox', { name: /Planting time/i }),
    ).toBeVisible();
    expect(screen.getByRole('combobox', { name: /Crop type/i })).toBeVisible();
    expect(
      screen.queryByRole('combobox', { name: /Growth form/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('combobox', { name: /Sow method/i }),
    ).not.toBeInTheDocument();

    await user.click(screen.getByText('Advanced filters'));

    expect(
      screen.getByRole('combobox', { name: /Growth form/i }),
    ).toBeVisible();
    expect(screen.getByRole('combobox', { name: /Sow method/i })).toBeVisible();

    const search = await screen.findByRole('searchbox', {
      name: 'Search crops',
    });

    await user.clear(search);
    await user.type(search, 'tomato');
    await user.click(
      await screen.findByRole('button', { name: 'Tomato crop' }),
    );

    expect(
      screen.getAllByText(/Using Detroit|Using saved garden location/i).length,
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByText(
        /Plant now|Start indoors now|Possible now with protection|Wait until after frost|Too late for this spring window|Good for fall/i,
      ).length,
    ).toBeGreaterThan(0);
  }, 30_000);

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

    fireEvent.change(within(editor).getByLabelText('Plant spacing in inches'), {
      target: { value: '18' },
    });
    expect(within(editor).getByText('18 in current')).toBeVisible();
    expect(
      within(editor).queryByText('Spacing override'),
    ).not.toBeInTheDocument();

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

    expect(
      within(editor).queryByText('Picture metadata'),
    ).not.toBeInTheDocument();
    expect(
      within(editor).queryByRole('button', { name: 'Reserve picture slot' }),
    ).not.toBeInTheDocument();
    expect(
      within(editor).queryByLabelText('Picture label'),
    ).not.toBeInTheDocument();
  });

  it('shows trellis link controls for grid-trellis crops in the plant editor', async () => {
    const user = userEvent.setup();
    const services = await createConfiguredPlanServices();
    const currentUser = services.authService.getCurrentUser();

    if (!currentUser) {
      throw new Error('Expected signed-in test user.');
    }

    await services.gardenRepository.saveGarden({
      ...createDefaultGarden(currentUser.uid),
      climateProfile: {
        ...detroitClimateProfile,
        source: 'user',
      },
      plantings: [
        {
          ...createDefaultPlanting({
            id: 'cucumber-1',
            label: 'Cucumber',
            xFt: 3,
            yFt: 3,
          }),
          cropId: 'cucumber',
        },
      ],
      structures: [
        {
          ...createDefaultStructure({
            id: 'trellis-1',
            type: 'trellis',
            xFt: 2,
            yFt: 2,
          }),
          label: 'Saved trellis',
        },
      ],
    });

    renderRoute('/app/plan', services);

    await user.click(
      await screen.findByRole('button', {
        name: 'Cucumber at X: 3.0 ft, Y: 3.0 ft',
      }),
    );
    await openFocusedPlantEditor(user);

    const editor = await screen.findByRole('dialog', { name: /Edit Cucumber/ });

    expect(within(editor).getByText('No linked trellis')).toBeVisible();
    await user.click(
      within(editor).getByRole('button', { name: 'Link Saved trellis' }),
    );

    expect(await within(editor).findByText('Saved trellis')).toBeVisible();
    expect(
      within(editor).getByRole('button', { name: 'Unlink Saved trellis' }),
    ).toBeVisible();
  });

  it('clears the seasonal crop board from Choose Plants', async () => {
    const user = userEvent.setup();
    const services = await createConfiguredPlanServices();

    renderRoute('/app/plan', services);

    await openChoosePlantsFromTopBar(user);
    await user.type(
      screen.getByRole('searchbox', { name: 'Search plants' }),
      'tomato',
    );
    await user.click(await screen.findByRole('button', { name: 'Add Tomato' }));
    await expandPickedPlantsPanel(user);

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
    expect(within(board).getByText('Row form')).toBeVisible();
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

    expect(
      within(board).getByText('Search and add crops to start.'),
    ).toBeVisible();
    expect(
      screen.getByRole('button', { name: 'Save and improve plan' }),
    ).toBeDisabled();
  }, 30_000);

  it('shows planted crops in the reference dropdown and filters them from the initial board state', async () => {
    const user = userEvent.setup();
    const services = await createConfiguredPlanServices();

    renderRoute('/app/plan', services);

    await openChoosePlantsFromTopBar(user);
    await user.type(
      screen.getByRole('searchbox', { name: 'Search plants' }),
      'tomato',
    );
    await user.click(await screen.findByRole('button', { name: 'Add Tomato' }));
    await user.click(screen.getByRole('button', { name: 'Save list' }));

    await addTomato(user);
    await openChoosePlantsFromTopBar(user);
    await expandPickedPlantsPanel(user);

    const board = screen.getByRole('region', { name: 'Season crop board' });
    const plantedCropSelect = within(board).getByRole('combobox', {
      name: 'Crops already on the plot',
    });

    expect(plantedCropSelect).toHaveDisplayValue('Tomato · 1 on plot');
    expect(
      within(board).getByText('Search and add crops to start.'),
    ).toBeVisible();
    expect(
      within(board).queryByRole('heading', { name: 'Tomato' }),
    ).not.toBeInTheDocument();
  }, 30_000);

  it('compares a small set of practical crop facts from Choose Plants', async () => {
    const user = userEvent.setup();
    const services = await createConfiguredPlanServices();

    renderRoute('/app/plan', services);

    await openChoosePlantsFromTopBar(user);
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
    await expandPickedPlantsPanel(user);

    const comparePanel = screen.getByRole('region', {
      name: 'Crop planning compare',
    });

    expect(within(comparePanel).getByText('Tomato')).toBeVisible();
    expect(within(comparePanel).getByText('Basil')).toBeVisible();
    expect(
      within(comparePanel).getByText('Check a few crops side by side'),
    ).toBeVisible();
    expect(
      within(comparePanel).getByLabelText(/Space: 3 plants .* sq ft/),
    ).toBeVisible();
    expect(within(comparePanel).getAllByLabelText(/^Sun:/)).toHaveLength(2);
    expect(within(comparePanel).getAllByLabelText(/^Plot fit:/)).toHaveLength(
      2,
    );
    expect(within(comparePanel).getAllByLabelText(/^Support:/)).toHaveLength(2);
    expect(within(comparePanel).getAllByLabelText(/^Harvest:/)).toHaveLength(2);
    expect(
      within(comparePanel).queryByText(/Best planning match|Harder than/),
    ).not.toBeInTheDocument();

    await user.click(
      within(comparePanel).getByRole('button', { name: 'Clear compare' }),
    );

    expect(
      screen.queryByRole('region', { name: 'Crop planning compare' }),
    ).not.toBeInTheDocument();
  }, 30_000);

  it('searches specific generated crops from the full plant library', async () => {
    const user = userEvent.setup();
    const services = await createConfiguredPlanServices();

    renderRoute('/app/plan', services);

    await openChoosePlantsFromTopBar(user);
    await user.click(screen.getByRole('button', { name: 'More filters' }));
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
      screen.getByRole('combobox', { name: 'Plot fit' }),
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
      screen.getByRole('combobox', { name: 'Plot fit' }),
      'any',
    );
    await user.type(
      screen.getByRole('searchbox', { name: 'Search plants' }),
      'winter kale',
    );

    expect(
      await screen.findByRole('button', { name: 'Add Winter Kale' }),
    ).toBeVisible();
  }, 20_000);

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
    await user.click(screen.getByRole('button', { name: 'Place on plan' }));

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
    await user.click(screen.getByLabelText('Use accessible-width path'));
    await user.click(screen.getByRole('button', { name: 'Place on plan' }));

    expect(
      await screen.findByRole('button', {
        name: 'Pathway, walkable width 4.0 ft, at X: 1.0 ft, Y: 0.0 ft',
      }),
    ).toBeVisible();
    expect(await screen.findByText('4 ft by 8 ft')).toBeVisible();
    expect(await screen.findByText('Accessible')).toBeVisible();
  });

  it('opens the access path inspector instead of the layout generator when a path is clicked', async () => {
    const user = userEvent.setup();
    const services = await createConfiguredPlanServices();

    renderRoute('/app/plan', services);

    await clickMode(user, 'Structure');
    await user.selectOptions(
      await screen.findByRole('combobox', { name: 'Plot structure type' }),
      'pathway',
    );
    await user.click(screen.getByRole('button', { name: 'Place on plan' }));

    const accessPath = await screen.findByRole('button', {
      name: /Pathway, walkable width/,
    });

    await clickMode(user, 'Generate layout');
    expect(
      await screen.findByText(
        'Add plants before generating a layout suggestion.',
      ),
    ).toBeVisible();

    await user.click(accessPath);

    const inspector = await screen.findByRole('complementary', {
      name: 'Selected item inspector',
    });
    expect(inspector).toHaveTextContent('Pathway');
    expect(inspector).toHaveTextContent('Path standard');
    expect(
      screen.queryByText('Add plants before generating a layout suggestion.'),
    ).not.toBeInTheDocument();
  });

  it('warns when planting spacing is unrealistic', async () => {
    const user = userEvent.setup();
    const services = await createConfiguredPlanServices();

    renderRoute('/app/plan', services);

    await addTomato(user);
    await addTomato(user);

    await clickPrimaryPlanAction(user, 'Review problems');

    expect(await screen.findByText('What needs attention')).toBeVisible();
    expect(
      screen.queryByRole('region', { name: 'Planting checks' }),
    ).not.toBeInTheDocument();
    expect(await screen.findByText('Spacing collision')).toBeVisible();
  }, 15_000);

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
        ...detroitClimateProfile,
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

    await clickPrimaryPlanAction(user, 'Review problems');

    expect(await screen.findByText('What needs attention')).toBeVisible();

    const applyButtons = await screen.findAllByRole('button', {
      name: 'Apply fix',
    });
    const applyButton = applyButtons[0];

    if (!applyButton) {
      throw new Error('Expected an apply button in the planting review panel.');
    }

    await user.click(applyButton);

    const ignoreButtons = await screen.findAllByRole('button', {
      name: 'Ignore for now',
    });
    const ignoreButton = ignoreButtons[0];

    if (!ignoreButton) {
      throw new Error(
        'Expected an ignore button in the planting review panel.',
      );
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

  it('keeps Plan focused on layout review instead of weather diagnostics', async () => {
    const user = userEvent.setup();
    const services = await createConfiguredPlanServices();

    renderRoute('/app/plan', services);

    await clickPrimaryPlanAction(user, 'Review problems');

    expect(
      await screen.findByRole('region', { name: 'Layout suggestion' }),
    ).toBeVisible();
    expect(
      screen.queryByRole('region', { name: 'Succession windows' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('region', { name: 'Planting checks' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Update weather' }),
    ).not.toBeInTheDocument();
  });

  it('resizes the plot, clamps plants, and keeps changes unsaved', async () => {
    const user = userEvent.setup();
    const services = await createConfiguredPlanServices();

    renderRoute('/app/plan', services);

    await addTomato(user);
    await user.click(screen.getByRole('button', { name: 'Plot settings' }));
    const widthInput = await screen.findByLabelText('Width in feet');

    await user.clear(widthInput);
    await user.type(widthInput, '4');
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
    await openFocusedPlantEditor(user);
    await user.click(screen.getByText('Sun, footprint, and warnings'));
    expect(await screen.findByText('X 4.0 ft, Y 3.0 ft')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Save' })).toBeVisible();
  }, 30_000);

  it('selects a plant from a click without opening the editor or marking dirty', async () => {
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

    expect(
      screen.queryByRole('complementary', { name: 'Crop focus' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('dialog', { name: /Edit Saved tomato/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Save' }),
    ).not.toBeInTheDocument();
  });

  it('selects a plant from keyboard activation without opening the editor', async () => {
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

    const plant = await screen.findByRole('button', {
      name: 'Saved tomato at X: 2.5 ft, Y: 3.0 ft',
    });

    plant.focus();
    await user.keyboard('{Enter}');

    expect(
      screen.queryByRole('complementary', { name: 'Crop focus' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('dialog', { name: /Edit Saved tomato/ }),
    ).not.toBeInTheDocument();

    plant.focus();
    await user.keyboard(' ');

    expect(
      screen.queryByRole('complementary', { name: 'Crop focus' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('dialog', { name: /Edit Saved tomato/ }),
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
    expect(within(carrotGroup).getByText('Carrot')).toBeVisible();
    expect(within(carrotGroup).getByText('3 plants')).toBeVisible();

    await user.click(carrotGroup);

    expect(
      screen.queryByRole('tooltip', { name: 'Carrot, 3 plants' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('complementary', { name: 'Crop focus' }),
    ).not.toBeInTheDocument();
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
    await user.click(screen.getByText('Sun, footprint, and warnings'));
    expect(await screen.findByText('X 4.0 ft, Y 3.0 ft')).toBeVisible();

    await user.click(screen.getByTestId('plant-editor-backdrop'));
    expect(
      screen.queryByRole('dialog', {
        name: /Edit Carrot/,
      }),
    ).not.toBeInTheDocument();

    await user.click(carrotGroup);
    await openFocusedPlantEditor(user);

    const spacingInput = await screen.findByRole('spinbutton', {
      name: 'Plant spacing in inches',
    });
    fireEvent.change(spacingInput, { target: { value: '12' } });

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
    await clickPrimaryPlanAction(user, /Details/);

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
  await screen.findByRole('dialog', { name: 'Add Plant' });
  const search = await screen.findByRole('searchbox', {
    name: 'Search crops',
  });

  await user.clear(search);
  await user.type(search, 'tomato');
  await user.click(
    await screen.findByRole(
      'button',
      { name: 'Tomato crop' },
      { timeout: 20_000 },
    ),
  );
  await user.click(screen.getByRole('button', { name: 'Add plant' }));
}

async function openChoosePlantsFromTopBar(
  user: ReturnType<typeof userEvent.setup>,
) {
  await user.click(await screen.findByRole('button', { name: /add plants/i }));
  await screen.findByRole('dialog', { name: 'Choose Plants' });
}

async function expandPickedPlantsPanel(
  user: ReturnType<typeof userEvent.setup>,
) {
  const expandButton = await screen.findByRole('button', {
    name: 'Expand picked plants',
  });

  if (expandButton.getAttribute('aria-expanded') !== 'true') {
    await user.click(expandButton);
  }
}

async function clickMode(
  user: ReturnType<typeof userEvent.setup>,
  name: RegExp | string,
) {
  const rail = await screen.findByRole('complementary', {
    name: 'More plan tools',
  });
  await user.click(
    await within(rail).findByRole('button', { name: 'Open more tools' }),
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
  const primaryActions =
    (await screen
      .findByRole('navigation', {
        name: 'Primary plan actions',
      })
      .catch(() => null)) ?? null;

  if (primaryActions) {
    const button = within(primaryActions).queryByRole('button', { name });

    if (button) {
      await user.click(button);
      return;
    }
  }

  await clickMode(user, name);
}

async function openFocusedPlantEditor(
  user: ReturnType<typeof userEvent.setup>,
) {
  await clickPrimaryPlanAction(user, /Details/);
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
      ...detroitClimateProfile,
      source: 'user',
    },
  });

  return services;
}

function mockElementRect(
  element: HTMLElement,
  {
    height,
    left = 0,
    top = 0,
    width,
  }: {
    height: number;
    left?: number;
    top?: number;
    width: number;
  },
) {
  Object.defineProperty(element, 'getBoundingClientRect', {
    configurable: true,
    value: () => ({
      bottom: top + height,
      height,
      left,
      right: left + width,
      toJSON: () => ({}),
      top,
      width,
      x: left,
      y: top,
    }),
  });
}

function dragElement(
  element: HTMLElement,
  {
    endX,
    endY,
    startX,
    startY,
  }: {
    endX: number;
    endY: number;
    startX: number;
    startY: number;
  },
) {
  fireEvent.pointerDown(element, {
    button: 0,
    buttons: 1,
    clientX: startX,
    clientY: startY,
    pointerId: 1,
    pointerType: 'mouse',
  });
  fireEvent.pointerMove(element, {
    buttons: 1,
    clientX: endX,
    clientY: endY,
    pointerId: 1,
    pointerType: 'mouse',
  });
  fireEvent.pointerUp(element, {
    button: 0,
    clientX: endX,
    clientY: endY,
    pointerId: 1,
    pointerType: 'mouse',
  });
}
