import { expect, test, type Locator, type Page } from '@playwright/test';

import { openPlanTool, signInWithMockPassword } from './appSmokeHelpers';

test('dragging a plant preserves grab offset and viewport position', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1365, height: 768 });
  await signInWithMockPassword(page);
  await addTomatoToPlan(page);
  await page.getByRole('button', { name: 'Close crop focus' }).click();
  await enlargePlot(page);
  await page.getByRole('button', { name: '100%' }).click();
  await expect(page.locator('[aria-label="Current zoom"]')).toHaveText('100%');

  const viewport = page.getByTestId('plot-viewport');
  await viewport.evaluate((element) => {
    element.scrollLeft = 120;
    element.scrollTop = 60;
  });
  const lockedScroll = await readViewportScroll(page);
  const plant = page.getByRole('button', {
    name: 'Tomato at X: 6.0 ft, Y: 4.0 ft',
  });
  const plantBox = await plant.boundingBox();

  if (!plantBox) {
    throw new Error('Expected tomato to have a visible bounding box.');
  }

  await page.mouse.move(
    plantBox.x + plantBox.width * 0.8,
    plantBox.y + plantBox.height / 2,
  );
  await page.mouse.down();
  await viewport.evaluate((element) => {
    element.scrollLeft = 180;
    element.scrollTop = 96;
  });
  await page.mouse.move(
    plantBox.x + plantBox.width * 0.8 + 64,
    plantBox.y + plantBox.height / 2 + 32,
    { steps: 4 },
  );
  await page.mouse.up();

  await expect(
    page.getByRole('button', { name: 'Tomato at X: 8.0 ft, Y: 5.0 ft' }),
  ).toBeVisible();
  expect(await readViewportScroll(page)).toEqual(lockedScroll);
});

test('workspace panning requires the explicit pan control', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1365, height: 768 });
  await signInWithMockPassword(page);
  await enlargePlot(page);
  await page.getByRole('button', { name: '100%' }).click();
  await expect(page.locator('[aria-label="Current zoom"]')).toHaveText('100%');

  const plot = page.getByTestId('garden-plot');
  const firstBox = await getBox(plot, 'Expected plot to be visible.');

  await page.mouse.move(firstBox.x + 640, firstBox.y + 160);
  await page.mouse.down();
  await page.mouse.move(firstBox.x + 700, firstBox.y + 190, { steps: 3 });
  await page.mouse.up();

  const unchangedBox = await getBox(plot, 'Expected plot to stay visible.');
  expect(Math.round(unchangedBox.x)).toBe(Math.round(firstBox.x));
  expect(Math.round(unchangedBox.y)).toBe(Math.round(firstBox.y));

  await page.getByRole('button', { name: 'Pan canvas' }).click();
  await page.mouse.move(unchangedBox.x + 640, unchangedBox.y + 160);
  await page.mouse.down();
  await page.mouse.move(unchangedBox.x + 700, unchangedBox.y + 190, {
    steps: 3,
  });
  await page.mouse.up();

  const pannedBox = await getBox(plot, 'Expected plot to remain visible.');
  expect(Math.round(pannedBox.x)).toBeGreaterThan(Math.round(unchangedBox.x));
  expect(Math.round(pannedBox.y)).toBeGreaterThan(Math.round(unchangedBox.y));
});

test('plant selection shows a preview before the inspector', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1365, height: 768 });
  await signInWithMockPassword(page);
  await addTomatoToPlan(page);

  const focus = page.getByRole('complementary', { name: 'Crop focus' });
  await expect(focus).toBeVisible();
  await expect(page.getByLabel('Plan context panel')).toHaveCount(0);
  await expect(focus.getByText('Selected plant')).toBeVisible();
  await expect(focus.getByRole('heading', { name: 'Tomato' })).toBeVisible();
  await expect(page.locator('[data-influence-overlay="true"]')).toHaveCount(0);

  await focus.getByRole('button', { name: 'Show influence' }).click();
  await expect(page.locator('[data-influence-overlay="true"]')).toBeVisible();
  await expect(page.locator('[data-influence-zone="spacing"]')).toBeVisible();
  await expect(focus.getByText(/keep-away radius/)).toBeVisible();

  await focus.getByRole('button', { name: 'Hide influence' }).click();
  await expect(page.locator('[data-influence-overlay="true"]')).toHaveCount(0);

  const tomato = page.getByRole('button', {
    name: 'Tomato at X: 6.0 ft, Y: 4.0 ft',
  });
  const tomatoLabel = page
    .locator('[role="tooltip"]')
    .filter({ hasText: 'Tomato' });

  await tomato.click();
  await expect(tomatoLabel).toBeVisible();
  await expect(page.getByLabel('Plan context panel')).toHaveCount(0);

  await page.getByRole('button', { name: 'Edit Tomato group' }).click();
  await expect(page.getByRole('dialog', { name: /Edit Tomato/ })).toBeVisible();

  await page
    .getByTestId('plant-editor-backdrop')
    .click({ position: { x: 8, y: 8 } });
  await expect(page.getByLabel('Plan context panel')).toHaveCount(0);
  await expect(page.getByRole('dialog', { name: /Edit Tomato/ })).toHaveCount(
    0,
  );
  await expect(tomatoLabel).toBeHidden();

  await tomato.click();
  await expect(tomatoLabel).toBeVisible();
  await focus.getByRole('tab', { name: 'Crop' }).click();
  await expect(focus.getByText('1 plant')).toBeVisible();

  await focus.getByRole('tab', { name: 'Needs' }).click();
  await expect(focus.getByText(/Cage required/)).toBeVisible();

  await focus.getByRole('button', { name: /Open details/ }).click();
  await expect(page.getByRole('dialog', { name: /Edit Tomato/ })).toBeVisible();
  await expect(page.getByTestId('plant-editor-layer')).toBeVisible();
  await expect(page.getByTestId('plant-editor-backdrop')).toHaveCount(0);

  await page.getByTestId('garden-plot').click({ position: { x: 18, y: 18 } });
  await expect(page.getByRole('dialog', { name: /Edit Tomato/ })).toBeVisible();
  await expect(tomatoLabel).toBeHidden();
});

test('plant focus and overlays stay usable with reduced motion', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 1365, height: 768 });
  await signInWithMockPassword(page);

  const viewport = page.getByTestId('plot-viewport');
  const viewportWidth = await viewport.evaluate(
    (element): number => element.clientWidth,
  );

  await addTomatoToPlan(page);
  const focus = page.getByRole('complementary', { name: 'Crop focus' });
  await expect(focus).toBeVisible();

  await focus.getByRole('button', { name: 'Show influence' }).click();
  await expect(page.locator('[data-influence-overlay="true"]')).toBeVisible();
  await expect(viewport).toHaveJSProperty('clientWidth', viewportWidth);

  await focus.getByRole('button', { name: /Open details/ }).click();
  await expect(page.getByRole('dialog', { name: /Edit Tomato/ })).toBeVisible();
  await expect(viewport).toHaveJSProperty('clientWidth', viewportWidth);
});

test('mobile plant focus stays compact and leaves the plot primary', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 780 });
  await signInWithMockPassword(page);

  const viewport = page.getByTestId('plot-viewport');
  const viewportBox = await getBox(
    viewport,
    'Expected mobile plot viewport to stay visible.',
  );

  expect(viewportBox.height).toBeGreaterThanOrEqual(500);

  await addTomatoToPlan(page);

  const focus = page.getByRole('complementary', { name: 'Crop focus' });
  await expect(focus).toBeVisible();

  const focusBox = await getBox(
    focus,
    'Expected mobile crop focus card to stay visible.',
  );
  const viewportSize = page.viewportSize();

  if (!viewportSize) {
    throw new Error('Expected viewport size for mobile crop focus assertion.');
  }

  expect(focusBox.height).toBeLessThanOrEqual(viewportSize.height * 0.48);
  expect(focusBox.y + focusBox.height).toBeLessThanOrEqual(
    viewportSize.height - 92,
  );

  await focus.getByRole('button', { name: /Open details/ }).click();
  const editor = page.getByRole('dialog', { name: /Edit Tomato/ });
  await expect(editor).toBeVisible();

  const panelBox = await getBox(
    editor,
    'Expected mobile plant editor sheet to stay visible.',
  );

  expect(panelBox.height).toBeLessThanOrEqual(viewportSize.height * 0.78);
  expect(panelBox.y).toBeGreaterThanOrEqual(viewportSize.height * 0.18);
  expect(panelBox.y + panelBox.height).toBeLessThanOrEqual(
    viewportSize.height - 12,
  );
});

async function addTomatoToPlan(page: Page) {
  await openPlanTool(page, 'Plant');
  await page.getByRole('button', { name: 'Open plant picker' }).click();
  await page.getByRole('searchbox', { name: 'Search crops' }).fill('tomato');
  await page.getByRole('button', { exact: true, name: 'Tomato crop' }).click();
  await page.getByRole('button', { exact: true, name: 'Add plant' }).click();
  await expect(
    page.getByRole('button', { name: 'Tomato at X: 6.0 ft, Y: 4.0 ft' }),
  ).toBeVisible();
}

async function enlargePlot(page: Page) {
  await page.getByRole('button', { name: 'Plot settings' }).click();
  await page.getByLabel('Width in feet').fill('60');
  await page.getByLabel('Depth in feet').fill('20');
  await page.getByLabel('Depth in feet').press('Enter');
  await expect(page.getByTestId('garden-plot')).toHaveJSProperty(
    'clientWidth',
    1920,
  );
}

async function readViewportScroll(page: Page) {
  return page.getByTestId('plot-viewport').evaluate((element) => ({
    scrollLeft: element.scrollLeft,
    scrollTop: element.scrollTop,
  }));
}

async function getBox(locator: Locator, errorMessage: string) {
  const box = await locator.boundingBox();

  if (!box) {
    throw new Error(errorMessage);
  }

  return box;
}
