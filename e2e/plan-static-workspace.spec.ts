import { expect, test, type Locator, type Page } from '@playwright/test';

import { signInWithMockPassword } from './appSmokeHelpers';

test('Plan context panels overlay the stable plot viewport', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1365, height: 768 });
  await signInWithMockPassword(page);

  const plotViewport = page.getByTestId('plot-viewport');
  const contextPanel = page.getByLabel('Plan context panel');

  const viewportWidth = await plotViewport.evaluate(
    (viewport): number => viewport.clientWidth,
  );

  await clickLauncherTool(page, 'Generate layout');
  await expect(contextPanel).toBeVisible();
  await expect(plotViewport).toHaveJSProperty('clientWidth', viewportWidth);

  await page.getByRole('button', { name: 'Close mode controls' }).click();
  await expect(contextPanel).toHaveCount(0);
  await expect(plotViewport).toHaveJSProperty('clientWidth', viewportWidth);

  await clickLauncherTool(page, 'Generate layout');
  await expect(contextPanel).toBeVisible();
  await expect(plotViewport).toHaveJSProperty('clientWidth', viewportWidth);
});

test('large plots keep empty framed workspace around the board and fit recenters it', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1365, height: 768 });
  await signInWithMockPassword(page);
  await enlargePlot(page);
  await page.getByRole('button', { name: '100%' }).click();
  await expect(page.locator('[aria-label="Current zoom"]')).toHaveText('100%');

  const plotViewport = page.getByTestId('plot-viewport');
  await plotViewport.evaluate((element) => {
    element.scrollLeft = element.scrollWidth - element.clientWidth;
    element.scrollTop = element.scrollHeight - element.clientHeight;
  });

  const viewportBox = await getVisibleBox(
    plotViewport,
    'Expected plot viewport to stay visible.',
  );
  const plotShellBox = await getVisibleBox(
    page.getByTestId('plot-shell'),
    'Expected plot shell to stay visible.',
  );

  expect(
    viewportBox.x + viewportBox.width - (plotShellBox.x + plotShellBox.width),
  ).toBeGreaterThan(120);
  expect(
    viewportBox.y + viewportBox.height - (plotShellBox.y + plotShellBox.height),
  ).toBeGreaterThan(80);

  await page.getByRole('button', { name: 'Fit' }).click();

  const centeredShellBox = await getVisibleBox(
    page.getByTestId('plot-shell'),
    'Expected plot shell to remain visible after Fit.',
  );
  const viewportCenterX = viewportBox.x + viewportBox.width / 2;
  const viewportCenterY = viewportBox.y + viewportBox.height / 2;
  const shellCenterX = centeredShellBox.x + centeredShellBox.width / 2;
  const shellCenterY = centeredShellBox.y + centeredShellBox.height / 2;

  expect(Math.abs(shellCenterX - viewportCenterX)).toBeLessThanOrEqual(72);
  expect(Math.abs(shellCenterY - viewportCenterY)).toBeLessThanOrEqual(72);

  await plotViewport.evaluate((element) => {
    element.scrollLeft = element.scrollWidth - element.clientWidth;
    element.scrollTop = element.scrollHeight - element.clientHeight;
  });

  await page.getByRole('button', { name: 'Fit' }).click();

  const refitShellBox = await getVisibleBox(
    page.getByTestId('plot-shell'),
    'Expected plot shell to remain visible after refitting.',
  );
  const refitShellCenterX = refitShellBox.x + refitShellBox.width / 2;
  const refitShellCenterY = refitShellBox.y + refitShellBox.height / 2;

  expect(Math.abs(refitShellCenterX - viewportCenterX)).toBeLessThanOrEqual(72);
  expect(Math.abs(refitShellCenterY - viewportCenterY)).toBeLessThanOrEqual(72);
});

test('Build tools launcher reopens mode panels on desktop and mobile', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1365, height: 768 });
  await signInWithMockPassword(page);

  await openPlanLauncher(page);
  const launcher = page.locator('[aria-label="More tools menu"]');

  await expect(launcher.getByRole('button', { name: 'Select' })).toHaveCount(0);
  await expect(launcher.getByRole('button', { name: 'Measure' })).toHaveCount(
    0,
  );
  await launcher.getByRole('button', { name: 'Structure' }).click();
  await expect(page.getByLabel('Plan context panel')).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Place on plan' }),
  ).toBeVisible();

  await page.getByRole('button', { name: 'Close mode controls' }).click();
  await expect(page.getByLabel('Plan context panel')).toHaveCount(0);

  await openPlanLauncher(page);
  await page
    .locator('[aria-label="More tools menu"]')
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
    page.getByRole('button', { name: 'Open more tools' }),
    'Expected mobile Plan launcher to stay thumb-sized.',
  );

  expect(launcherButtonBox.height).toBeGreaterThanOrEqual(44);

  await clickLauncherTool(page, 'Sun');
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
  const launcher = page.locator('[aria-label="More tools menu"]');

  if (!(await launcher.isVisible().catch(() => false))) {
    await page.getByRole('button', { name: 'Open more tools' }).click();
  }

  await expect(launcher).toBeVisible();
}

async function clickLauncherTool(page: Page, name: string) {
  await openPlanLauncher(page);
  await page
    .locator('[aria-label="More tools menu"]')
    .getByRole('button', { name })
    .click();
}

async function getVisibleBox(locator: Locator, errorMessage: string) {
  const box = await locator.boundingBox();

  if (!box) {
    throw new Error(errorMessage);
  }

  return box;
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
