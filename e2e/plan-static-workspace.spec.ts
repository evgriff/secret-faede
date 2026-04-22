import { expect, test, type Locator, type Page } from '@playwright/test';

import { signInWithMockPassword } from './appSmokeHelpers';

test('Plan context panels overlay the stable plot viewport', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1365, height: 768 });
  await signInWithMockPassword(page);

  const plotViewport = page.getByTestId('plot-viewport');
  const optimizeButton = page.getByRole('button', { name: 'Optimize' }).first();
  const contextPanel = page.getByLabel('Plan context panel');

  const viewportWidth = await plotViewport.evaluate(
    (viewport): number => viewport.clientWidth,
  );

  await optimizeButton.click();
  await expect(contextPanel).toBeVisible();
  await expect(plotViewport).toHaveJSProperty('clientWidth', viewportWidth);

  await page.getByRole('button', { name: 'Close mode controls' }).click();
  await expect(contextPanel).toHaveCount(0);
  await expect(plotViewport).toHaveJSProperty('clientWidth', viewportWidth);

  await optimizeButton.click();
  await expect(contextPanel).toBeVisible();
  await expect(plotViewport).toHaveJSProperty('clientWidth', viewportWidth);
});

test('Plan tools launcher reopens mode panels on desktop and mobile', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1365, height: 768 });
  await signInWithMockPassword(page);

  await openPlanLauncher(page);
  await page
    .getByLabel('Plan tool launcher')
    .getByRole('button', { name: 'Structure' })
    .click();
  await expect(page.getByLabel('Plan context panel')).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Place garden support' }),
  ).toBeVisible();

  await page.getByRole('button', { name: 'Close mode controls' }).click();
  await expect(page.getByLabel('Plan context panel')).toHaveCount(0);

  await openPlanLauncher(page);
  await page
    .getByLabel('Plan tool launcher')
    .getByRole('button', { name: 'Structure' })
    .click();
  await expect(page.getByLabel('Plan context panel')).toBeVisible();

  await page.setViewportSize({ width: 390, height: 780 });
  await page.getByRole('button', { name: 'Close mode controls' }).click();

  const mobileViewport = page.getByTestId('plot-viewport');
  const mobileViewportBox = await getVisibleBox(
    mobileViewport,
    'Expected mobile plot viewport to stay visible.',
  );
  const mobileControlsBox = await getVisibleBox(
    page.locator('[aria-label="Canvas controls"]'),
    'Expected compact mobile canvas controls to stay visible.',
  );

  expect(mobileViewportBox.height).toBeGreaterThanOrEqual(500);
  expect(mobileControlsBox.height).toBeLessThanOrEqual(56);

  await openPlanLauncher(page);
  const launcherButtonBox = await getVisibleBox(
    page.getByRole('button', { name: 'Open Plan tools' }),
    'Expected mobile Plan launcher to stay thumb-sized.',
  );

  expect(launcherButtonBox.height).toBeGreaterThanOrEqual(44);

  await page
    .getByLabel('Plan tool launcher')
    .getByRole('button', { name: 'Sun/Climate' })
    .click();
  await expect(
    page.getByRole('button', { name: 'Recalculate sun' }),
  ).toBeVisible();

  const panelBox = await getVisibleBox(
    page.getByLabel('Plan context panel'),
    'Expected mobile Plan bottom sheet to stay visible.',
  );
  const viewportSize = page.viewportSize();

  if (!viewportSize) {
    throw new Error('Expected viewport size for mobile Plan panel assertion.');
  }

  expect(panelBox.height).toBeLessThanOrEqual(viewportSize.height * 0.6);
  expect(panelBox.y).toBeGreaterThanOrEqual(viewportSize.height * 0.25);
  expect(panelBox.y + panelBox.height).toBeLessThanOrEqual(
    viewportSize.height - 104,
  );
});

async function openPlanLauncher(page: Page) {
  await page.getByRole('button', { name: 'Open Plan tools' }).click();
  await expect(page.getByLabel('Plan tool launcher')).toBeVisible();
}

async function getVisibleBox(locator: Locator, errorMessage: string) {
  const box = await locator.boundingBox();

  if (!box) {
    throw new Error(errorMessage);
  }

  return box;
}
