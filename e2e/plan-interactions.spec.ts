import { expect, test, type Locator, type Page } from '@playwright/test';

import { openPlanTool, signInWithMockPassword } from './appSmokeHelpers';

test('dragging a plant preserves grab offset and keeps plant surfaces closed on ordinary clicks', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1365, height: 768 });
  await signInWithMockPassword(page);
  await addTomatoToPlan(page);
  const focus = page.getByRole('complementary', { name: 'Crop focus' });
  await expect(focus).toHaveCount(0);
  await enlargePlot(page);
  await page.getByRole('button', { name: '100%' }).click();
  await expect(page.locator('[aria-label="Current zoom"]')).toHaveText('100%');

  const viewport = page.getByTestId('plot-viewport');
  await viewport.evaluate((element) => {
    element.scrollLeft = 120;
    element.scrollTop = 60;
  });
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
  await expect(focus).toHaveCount(0);
  await expect(page.getByRole('dialog', { name: /Edit Tomato/ })).toHaveCount(
    0,
  );
  await expect
    .poll(async () => {
      const previewBox = await getBox(
        plant,
        'Expected tomato preview to stay visible while dragging.',
      );

      return {
        deltaX: previewBox.x - plantBox.x,
        deltaY: previewBox.y - plantBox.y,
      };
    })
    .toEqual(
      expect.objectContaining({
        deltaX: expect.any(Number),
        deltaY: expect.any(Number),
      }),
    );
  await expect
    .poll(async () => {
      const previewBox = await getBox(
        plant,
        'Expected tomato preview to stay visible while dragging.',
      );

      return (
        Math.abs(previewBox.x - plantBox.x) +
        Math.abs(previewBox.y - plantBox.y)
      );
    })
    .toBeGreaterThan(24);
  await expect(
    page.getByRole('button', { name: 'Tomato at X: 8.0 ft, Y: 5.0 ft' }),
  ).toHaveCount(0);
  await page.mouse.up();

  const movedTomato = page
    .getByRole('button', { name: /^Tomato at X:/ })
    .first();
  await expect(movedTomato).toBeVisible();
  await expect(focus).toHaveCount(0);
  await expect(page.getByRole('dialog', { name: /Edit Tomato/ })).toHaveCount(
    0,
  );

  await movedTomato.click();
  await expect(focus).toHaveCount(0);
  await expect(page.getByRole('dialog', { name: /Edit Tomato/ })).toHaveCount(
    0,
  );
});

test('wheel scrolling flies around the framed workspace while pointer drag still requires the explicit pan control', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1365, height: 768 });
  await signInWithMockPassword(page);
  await enlargePlot(page);
  await page.getByRole('button', { name: '100%' }).click();
  await expect(page.locator('[aria-label="Current zoom"]')).toHaveText('100%');

  const plot = page.getByTestId('garden-plot');
  const viewport = page.getByTestId('plot-viewport');
  const firstBox = await getBox(plot, 'Expected plot to be visible.');
  const initialScroll = await readViewportScroll(page);

  await page.mouse.move(firstBox.x + 640, firstBox.y + 160);
  await page.mouse.down();
  await page.mouse.move(firstBox.x + 700, firstBox.y + 190, { steps: 3 });
  await page.mouse.up();

  expect(await readViewportScroll(page)).toEqual(initialScroll);

  const viewportBox = await getBox(
    viewport,
    'Expected plot viewport to be visible.',
  );
  await page.mouse.move(
    viewportBox.x + viewportBox.width / 2,
    viewportBox.y + viewportBox.height / 2,
  );
  await page.mouse.wheel(220, 180);

  await expect
    .poll(async () => readViewportScroll(page))
    .not.toEqual(initialScroll);

  const afterWheelScroll = await readViewportScroll(page);

  await page.keyboard.down('Control');
  await page.mouse.wheel(0, -240);
  await page.keyboard.up('Control');

  await expect(page.locator('[aria-label="Current zoom"]')).not.toHaveText(
    '100%',
  );
  await page.getByRole('button', { name: '100%' }).click();

  await page.getByRole('button', { name: 'Pan canvas' }).click();
  await page.mouse.move(firstBox.x + 640, firstBox.y + 160);
  await page.mouse.down();
  await page.mouse.move(firstBox.x + 700, firstBox.y + 190, {
    steps: 3,
  });
  await page.mouse.up();

  await expect
    .poll(async () => readViewportScroll(page))
    .not.toEqual(afterWheelScroll);

  const afterPanDragScroll = await readViewportScroll(page);
  expect(afterPanDragScroll.scrollLeft).toBeLessThan(
    afterWheelScroll.scrollLeft,
  );
  expect(afterPanDragScroll.scrollTop).toBeLessThan(afterWheelScroll.scrollTop);
});

test('plant spacing can be tightened in the editor and shrinks the grid box', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1365, height: 768 });
  await signInWithMockPassword(page);
  await addTomatoToPlan(page);

  const plant = page.getByRole('button', {
    name: 'Tomato at X: 6.0 ft, Y: 4.0 ft',
  });
  const initialBox = await getBox(plant, 'Expected tomato to be visible.');

  await plant.click();
  await expect(
    page.getByRole('button', { name: 'Adjust Tomato spacing' }),
  ).toHaveCount(0);
  await page.getByRole('button', { name: 'Edit Tomato group' }).click();
  const editor = page.getByRole('dialog', { name: /Edit Tomato/ });
  await expect(editor).toBeVisible();
  await editor.getByLabel('Plant spacing in inches').fill('6');

  await expect(
    editor.getByText('Spacing is tighter than the catalog spacing of 24 in.'),
  ).toBeVisible();
  await expect
    .poll(async () => {
      const box = await getBox(plant, 'Expected tomato to stay visible.');

      return box.width;
    })
    .toBeLessThan(initialBox.width);
});

test('marquee select marks multiple plant groups as planted in one action', async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date('2026-04-24T16:00:00.000Z'));
  await page.setViewportSize({ width: 1365, height: 768 });
  await signInWithMockPassword(page);
  await addCropToPlan(page, 'tomato', 'Tomato crop');
  await addCropToPlan(page, 'basil', 'Basil crop');

  const tomato = page.getByRole('button', {
    name: 'Tomato at X: 6.0 ft, Y: 4.0 ft',
  });
  const basil = page.getByRole('button', {
    name: /Basil at X:/,
  });
  const tomatoBox = await getBox(tomato, 'Expected tomato to be visible.');
  const basilBox = await getBox(basil, 'Expected basil to be visible.');
  const startX = Math.min(tomatoBox.x, basilBox.x) - 24;
  const startY = Math.min(tomatoBox.y, basilBox.y) - 24;
  const endX =
    Math.max(tomatoBox.x + tomatoBox.width, basilBox.x + basilBox.width) + 24;
  const endY =
    Math.max(tomatoBox.y + tomatoBox.height, basilBox.y + basilBox.height) + 24;

  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(endX, endY, { steps: 6 });
  await page.mouse.up();

  await expect(page.getByText('2 selected')).toBeVisible();
  await page.getByRole('button', { name: 'Mark selected as planted' }).click();
  await expect(page.getByLabel('Planted on')).toHaveValue('2026-04-24');
  await page.getByRole('button', { name: 'Apply planted date' }).click();
  await expect(tomato).toContainText('Anchored');
  await expect(basil).toContainText('Anchored');
});

test('plant selection stays quiet until wrench or Details opens the editor', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1365, height: 768 });
  await signInWithMockPassword(page);
  await addTomatoToPlan(page);

  const focus = page.getByRole('complementary', { name: 'Crop focus' });
  await expect(focus).toHaveCount(0);
  await expect(page.getByLabel('Plan context panel')).toHaveCount(0);
  await expect(page.locator('[data-influence-overlay="true"]')).toHaveCount(0);

  const tomato = page.getByRole('button', {
    name: 'Tomato at X: 6.0 ft, Y: 4.0 ft',
  });

  await tomato.click();
  await expect(tomato).toHaveAttribute('aria-pressed', 'true');
  await expect(focus).toHaveCount(0);
  await expect(page.getByRole('dialog', { name: /Edit Tomato/ })).toHaveCount(
    0,
  );
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

  await tomato.click();
  await expect(tomato).toHaveAttribute('aria-pressed', 'true');
  await openPlanTool(page, 'Details');
  await expect(page.getByRole('dialog', { name: /Edit Tomato/ })).toBeVisible();
  await expect(page.getByTestId('plant-editor-layer')).toBeVisible();
  await expect(page.getByTestId('plant-editor-backdrop')).toHaveCount(0);
  await expect(page.getByText('Picture metadata')).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: 'Reserve picture slot' }),
  ).toHaveCount(0);

  await page
    .getByTestId('garden-plot')
    .click({ force: true, position: { x: 18, y: 18 } });
  await expect(page.getByRole('dialog', { name: /Edit Tomato/ })).toBeVisible();
});

test('explicit plant editor stays usable with reduced motion', async ({
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
  await expect(focus).toHaveCount(0);
  await expect(viewport).toHaveJSProperty('clientWidth', viewportWidth);

  await openPlanTool(page, 'Details');
  await expect(page.getByRole('dialog', { name: /Edit Tomato/ })).toBeVisible();
  await expect(viewport).toHaveJSProperty('clientWidth', viewportWidth);
});

test('mobile plant editor keeps Close visible while the sheet scrolls', async ({
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
  await expect(focus).toHaveCount(0);
  const viewportSize = page.viewportSize();

  if (!viewportSize) {
    throw new Error('Expected viewport size for mobile editor assertion.');
  }

  await openPlanTool(page, 'Details');
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

  const closeButton = editor.getByRole('button', {
    name: 'Close plant editor',
  });
  await expect(closeButton).toBeVisible();
  await editor.evaluate((element) => {
    element.scrollTop = element.scrollHeight;
  });
  await expect(closeButton).toBeVisible();
});

async function addTomatoToPlan(page: Page) {
  await addCropToPlan(page, 'tomato', 'Tomato crop');
  await expect(
    page.getByRole('button', { name: 'Tomato at X: 6.0 ft, Y: 4.0 ft' }),
  ).toBeVisible();
}

async function addCropToPlan(
  page: Page,
  search: string,
  cropButtonName: string,
) {
  await openPlanTool(page, 'Plant');
  await page.getByRole('button', { name: 'Open plant picker' }).click();
  await page.getByRole('searchbox', { name: 'Search crops' }).fill(search);
  await page.getByRole('button', { exact: true, name: cropButtonName }).click();
  await page.getByRole('button', { exact: true, name: 'Add plant' }).click();
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
