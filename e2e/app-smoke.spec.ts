import { expect, test } from '@playwright/test';

import {
  addTomatoToSeasonList,
  enterDemoFromShell,
  expectSampleGardenSettings,
  generateAndApplyFirstLayout,
  openPlanTool,
  resetAndExitSampleGarden,
  savePlan,
  signInWithMockPassword,
} from './appSmokeHelpers';

test('allowlisted mock sign-in reaches and saves Plan', async ({ page }) => {
  await page.setViewportSize({ width: 1365, height: 768 });
  await signInWithMockPassword(page);
  await expect(page.getByText('12 ft by 8 ft')).toBeVisible();

  await openPlanTool(page, 'Plant');
  await page.getByRole('button', { name: 'Open plant picker' }).click();
  await page.getByRole('searchbox', { name: 'Search crops' }).fill('tomato');
  await page.getByRole('button', { exact: true, name: 'Tomato crop' }).click();
  await page.getByRole('button', { exact: true, name: 'Add plant' }).click();
  await expect(
    page.getByRole('button', { name: 'Tomato at X: 6.0 ft, Y: 4.0 ft' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Close crop focus' }).click();
  const plantBox = await page
    .getByRole('button', { name: 'Tomato at X: 6.0 ft, Y: 4.0 ft' })
    .boundingBox();

  if (!plantBox) {
    throw new Error('Expected plant to have a visible bounding box.');
  }

  await page.mouse.move(
    plantBox.x + plantBox.width / 2,
    plantBox.y + plantBox.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(
    plantBox.x + plantBox.width / 2 + 56,
    plantBox.y + plantBox.height / 2 + 28,
  );
  await page.mouse.up();
  await expect(
    page.getByRole('button', { name: 'Tomato at X: 7.8 ft, Y: 5.0 ft' }),
  ).toBeVisible();
  await openPlanTool(page, 'Structure');
  await page
    .getByRole('combobox', { name: 'Plot structure type' })
    .selectOption('trellis');
  await page.getByRole('button', { name: 'Place on plan' }).click();
  await expect(
    page.getByRole('button', { name: 'Trellis at X: 1.0 ft, Y: 1.0 ft' }),
  ).toBeVisible();
  await page
    .getByRole('button', { name: 'Trellis at X: 1.0 ft, Y: 1.0 ft' })
    .click();
  await page.keyboard.press('Shift+ArrowLeft');
  await page.keyboard.press('Shift+ArrowUp');
  await expect(
    page.getByRole('button', { name: 'Trellis at X: 0.0 ft, Y: 0.0 ft' }),
  ).toBeVisible();
  await page.keyboard.press('Control+A');
  await expect(page.getByText('2 selected')).toBeVisible();
  await savePlan(page);
  await expect(page.getByText('Saved', { exact: true })).toBeVisible();

  await page.reload();
  await expect(
    page.getByRole('button', { name: /Tomato at X:/ }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Trellis at X: 0.0 ft, Y: 0.0 ft' }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Save' })).toHaveCount(0);
});

test('second production user signs in on mobile with a persisted session', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 780 });
  await signInWithMockPassword(page, 'partner.gardener@example.com');

  await page.goto('/');
  await expect(
    page.getByRole('heading', {
      exact: true,
      name: 'Plan',
    }),
  ).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Sign in' })).toHaveCount(0);

  await page.getByRole('link', { name: 'Settings' }).click();
  await expect(
    page.getByRole('heading', { exact: true, name: 'Settings' }),
  ).toBeVisible();
  await expect(page.locator('[title="partner.gardener@example.com"]')).toHaveText('Partner Gardener');
});

test('garden plot has exact board sizing and scrolls large plots', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1365, height: 768 });
  await signInWithMockPassword(page);

  await expect(page.getByTestId('garden-plot')).toHaveJSProperty(
    'clientWidth',
    384,
  );
  await expect(page.getByTestId('garden-plot')).toHaveJSProperty(
    'clientHeight',
    256,
  );

  const smallViewportWidth = await page
    .getByTestId('plot-viewport')
    .evaluate((viewport): number => viewport.clientWidth);
  const smallShellWidth = await page
    .getByTestId('plot-shell')
    .evaluate((shell): number => shell.clientWidth);

  expect(smallShellWidth).toBeLessThan(smallViewportWidth);
  expect(smallShellWidth).toBeGreaterThan(
    await page
      .getByTestId('garden-plot')
      .evaluate((plot): number => plot.clientWidth),
  );

  await page.setViewportSize({ width: 512, height: 768 });
  await page.reload();
  await expect(page.getByTestId('garden-plot')).toHaveJSProperty(
    'clientWidth',
    384,
  );
  await expect(page.getByTestId('garden-plot')).toHaveJSProperty(
    'clientHeight',
    256,
  );

  await page.getByRole('button', { name: 'Plot settings' }).click();
  await page.getByLabel('Width in feet').fill('60');
  await page.getByLabel('Depth in feet').fill('20');
  await page.getByLabel('Depth in feet').press('Enter');

  await expect(page.getByTestId('garden-plot')).toHaveJSProperty(
    'clientWidth',
    1920,
  );
  const largePlotWidth = await page
    .getByTestId('garden-plot')
    .evaluate((plot): number => plot.clientWidth);
  const largeShellWidth = await page
    .getByTestId('plot-shell')
    .evaluate((shell): number => shell.clientWidth);
  const largeViewport = await page.getByTestId('plot-viewport').evaluate(
    (
      viewport,
    ): {
      clientWidth: number;
      scrollWidth: number;
    } => ({
      clientWidth: viewport.clientWidth,
      scrollWidth: viewport.scrollWidth,
    }),
  );

  expect(largePlotWidth).toBe(1920);
  expect(largeShellWidth).toBeGreaterThan(largePlotWidth);
  expect(largeViewport.scrollWidth).toBeGreaterThan(largeViewport.clientWidth);

  const controlsBeforeScroll = await page
    .locator('[aria-label="Canvas controls"]')
    .boundingBox();

  if (!controlsBeforeScroll) {
    throw new Error('Expected canvas controls to have a visible bounding box.');
  }

  await page.getByTestId('plot-viewport').evaluate((viewport) => {
    viewport.scrollLeft = 360;
    viewport.scrollTop = 160;
  });

  const controlsAfterScroll = await page
    .locator('[aria-label="Canvas controls"]')
    .boundingBox();

  if (!controlsAfterScroll) {
    throw new Error('Expected canvas controls to remain visible after scroll.');
  }

  expect(Math.round(controlsAfterScroll.x)).toBe(
    Math.round(controlsBeforeScroll.x),
  );
  expect(Math.round(controlsAfterScroll.y)).toBe(
    Math.round(controlsBeforeScroll.y),
  );

  await page.getByRole('button', { name: '100%' }).click();
  await expect(page.locator('[aria-label="Current zoom"]')).toHaveText('100%');
  await expect(page.getByRole('button', { name: '100%' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.getByRole('button', { name: 'Fit' }).click();
  await expect(page.getByRole('button', { name: 'Fit' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );

  await page.getByRole('button', { name: 'Overview' }).click();
  await expect(page.locator('[aria-label="Plot overview"]')).toBeVisible();
  await page.getByRole('button', { name: 'Collapse overview' }).click();
  await expect(page.locator('[aria-label="Plot overview"]')).toHaveCount(0);
});

test('non-allowlisted email has no sign-in path', async ({ page }) => {
  await page.goto('/');

  await page.getByLabel('Email').fill('blocked@example.com');
  await page.getByLabel('Password', { exact: true }).fill('password');
  await page.getByRole('button', { name: 'Sign in' }).click();

  await expect(
    page.getByText('This email is not allowed for Secret Faeries.'),
  ).toBeVisible();
});

test('Plan supports choose plants, one layout suggestion, publish, and revert', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1365, height: 768 });
  await signInWithMockPassword(page);
  await addTomatoToSeasonList(page);
  await generateAndApplyFirstLayout(page);

  await expect(page.getByText('Private draft', { exact: true })).toBeVisible();
  await expect(
    page
      .getByRole('button', { name: /Tomato(?: group, \d+ plants)? at X:/ })
      .first(),
  ).toBeVisible();

  await page.getByRole('button', { exact: true, name: 'Publish' }).click();
  const publishDialog = page.getByRole('dialog', { name: 'Publish draft' });

  await expect(publishDialog).toBeVisible();
  await expect(
    publishDialog.getByRole('heading', {
      name: 'Accepted into this draft',
    }),
  ).toBeVisible();
  await page
    .getByRole('dialog', { name: 'Publish draft' })
    .getByRole('button', { exact: true, name: 'Publish' })
    .click();
  await expect(page.getByRole('dialog', { name: 'Publish draft' })).toHaveCount(
    0,
  );
  await expect(page.getByText('Published', { exact: true })).toBeVisible();

  await openPlanTool(page, 'History');
  await expect(
    page.getByRole('dialog', { name: 'Revision history' }),
  ).toBeVisible();
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Review revert' }).last().click();
  await expect(
    page.getByRole('dialog', { name: 'Revision history' }),
  ).toHaveCount(0);
  await expect(
    page.getByRole('heading', { name: 'Set up your garden' }),
  ).toBeVisible();
});

test('sample garden loads populated Plan, Today, Feed, and Settings', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1365, height: 768 });
  await signInWithMockPassword(page);

  await enterDemoFromShell(page);
  await expect(
    page.getByRole('heading', { exact: true, name: 'Plan' }),
  ).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText('20 ft by 16 ft')).toBeVisible();
  await openPlanTool(page, 'Generate layout');
  await expect(
    page.getByRole('heading', { name: 'What needs attention' }),
  ).toBeVisible();
  await expect(
    page.getByRole('listitem').filter({ hasText: 'Path too narrow' }).first(),
  ).toHaveCount(0);
  const preview = page.getByRole('region', {
    name: 'Before and after preview',
  });

  if (!(await preview.isVisible().catch(() => false))) {
    await page
      .getByRole('button', { name: /Generate layout|Check again/ })
      .first()
      .click();
  }

  const layoutSuggestion = page.getByRole('region', {
    name: 'Layout suggestion',
  });

  await expect(
    layoutSuggestion.getByRole('heading', {
      exact: true,
      name: 'Try a different arrangement',
    }),
  ).toBeVisible();
  await expect(
    layoutSuggestion.getByRole('button', { name: 'Apply this layout' }),
  ).toBeVisible();
  await expect(
    layoutSuggestion.getByRole('button', { name: 'Keep current layout' }),
  ).toBeVisible();

  await page.getByRole('link', { name: 'Today' }).click();
  await expect(
    page.getByRole('heading', { name: 'Watering work' }),
  ).toBeVisible();
  const wateringPanel = page
    .locator('section')
    .filter({ has: page.getByRole('heading', { name: 'Watering work' }) })
    .first();
  await expect(
    wateringPanel.getByText('roots and salad bed', { exact: false }).first(),
  ).toBeVisible();
  await expect(
    wateringPanel.getByRole('button', { name: 'Water all done' }).first(),
  ).toBeVisible();
  await expect(
    wateringPanel.getByRole('button', { name: 'Review watering' }).first(),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', {
      exact: true,
      name: 'Slug pressure in lettuce',
    }),
  ).toBeVisible();

  await page.getByRole('link', { exact: true, name: 'Feed' }).click();
  await expect(
    page.getByRole('heading', {
      exact: true,
      name: 'Watered Roots and salad bed',
    }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', {
      exact: true,
      name: 'Slug pressure in lettuce',
    }),
  ).toBeVisible();
  const peaPhoto = page.getByRole('img', { name: 'pea-trellis-demo.svg' });

  await expect(
    page.getByRole('heading', { exact: true, name: 'Peas caught the trellis' }),
  ).toBeVisible();
  await expect(peaPhoto).toBeVisible();
  const peaPhotoBox = await peaPhoto.boundingBox();

  expect(Math.round(peaPhotoBox?.width ?? 0)).toBeGreaterThan(560);
  await page.getByRole('button', { name: 'Harvests' }).click();
  await expect(
    page.getByRole('heading', { name: 'French breakfast radish' }),
  ).toBeVisible();

  await page.getByRole('link', { name: 'Settings' }).click();
  await expectSampleGardenSettings(page);
  await page.getByLabel('Watering check time').fill('08:45');
  await page.getByRole('button', { name: 'Save settings' }).click();
  await expect(page.getByText('Saved', { exact: true })).toBeVisible();
  await resetAndExitSampleGarden(page);
  await page.getByRole('link', { exact: true, name: 'Plan' }).click();
  await expect(page.getByText('12 ft by 8 ft')).toBeVisible();
});

test('Feed saves field memory while offline with explicit queued state', async ({
  context,
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 780 });
  await signInWithMockPassword(page);
  await page.getByRole('link', { name: 'Feed' }).click();
  await expect(
    page.getByRole('heading', { exact: true, name: 'Feed' }),
  ).toBeVisible();

  await context.setOffline(true);
  await expect(
    page.getByText(/Text memories and harvests can save locally/),
  ).toBeVisible();
  await page.getByRole('button', { name: 'New entry' }).click();
  const composer = page.getByRole('dialog', { name: 'New feed entry' });

  await expect(composer).toBeVisible();
  const composerBox = await composer.boundingBox();
  const composerWidth = Math.round(composerBox?.width ?? 0);
  const composerHeight = Math.round(composerBox?.height ?? 0);

  expect(composerWidth).toBeGreaterThanOrEqual(386);
  expect(composerWidth).toBeLessThanOrEqual(390);
  expect(composerHeight).toBeGreaterThanOrEqual(770);
  await page.getByLabel('Title').fill('Offline note');
  await page.getByLabel('Notes').fill('Observed tomatoes before rain.');
  await composer.getByRole('button', { name: 'Close' }).click();
  await expect(composer).toHaveCount(0);
  await page.getByRole('button', { name: 'New entry' }).click();
  await expect(page.getByLabel('Title')).toHaveValue('Offline note');
  await expect(page.getByLabel('Notes')).toHaveValue(
    'Observed tomatoes before rain.',
  );
  await page.getByRole('button', { name: 'Save note' }).click();

  await expect(
    page.getByText('Queued locally', { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByText(/Text memory is saved here and will sync/),
  ).toBeVisible();
  await expect(page.getByText('Offline note')).toBeVisible();

  await context.setOffline(false);
});
