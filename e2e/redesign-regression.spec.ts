import { expect, test, type Page } from '@playwright/test';

import {
  addTomatoToSeasonList,
  enterDemoFromShell,
  openPlanTool,
  signInWithMockPassword,
} from './appSmokeHelpers';

test('quantity-first Add Plant creates one grouped footprint without resizing the plot', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1365, height: 768 });
  await signInWithMockPassword(page);

  const viewport = page.getByTestId('plot-viewport');
  const stableSize = await readViewportSize(page);

  await openPlanTool(page, 'Plant');
  await expect(viewport).toHaveJSProperty('clientWidth', stableSize.width);
  await expect(viewport).toHaveJSProperty('clientHeight', stableSize.height);

  await page.getByRole('button', { name: 'Open plant picker' }).click();
  const addPlant = page.getByRole('dialog', { name: 'Add Plant' });

  await expect(addPlant).toBeVisible();
  await expect(addPlant.getByLabel('How many plants?')).toHaveValue('1');
  await expect(addPlant.getByText(/Recommended:/)).toBeVisible();
  await expect(addPlant.getByLabel('Need')).toHaveCount(0);
  await expect(addPlant.getByLabel('Priority')).toHaveCount(0);
  await expect(addPlant.getByText('Fit confidence')).toHaveCount(0);

  await addPlant
    .getByRole('searchbox', { name: 'Search crops' })
    .fill('tomato');
  await addPlant
    .getByRole('button', { exact: true, name: 'Tomato crop' })
    .click();
  await addPlant.getByLabel('How many plants?').fill('3');
  await expect(
    addPlant.getByText(/Will place 3 plants as one group\./),
  ).toBeVisible();
  await addPlant.getByRole('button', { name: 'Add plant' }).click();

  await expect(
    page.getByRole('button', { name: /Tomato group, 3 plants at X:/ }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: /Tomato 1 at X:/ }),
  ).toHaveCount(0);
  await expect(page.getByLabel('Edit Tomato group')).toBeVisible();
  await expect(viewport).toHaveJSProperty('clientWidth', stableSize.width);
  await expect(
    page.getByRole('complementary', { name: 'Crop focus' }),
  ).toBeVisible();

  const focusedSize = await readViewportSize(page);

  expect(focusedSize.height).toBeGreaterThanOrEqual(500);
});

test('plant picking modals keep their footer actions visible on short viewports', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1365, height: 620 });
  await signInWithMockPassword(page);

  await page
    .getByRole('button', { name: /add plants/i })
    .first()
    .click();
  const choosePlants = page.getByRole('dialog', { name: 'Choose Plants' });

  await expect(choosePlants).toBeVisible();
  await expect(
    choosePlants.getByRole('button', { name: 'Close choose plants' }),
  ).toBeInViewport();
  await expect(
    choosePlants.getByRole('button', { name: 'Save list' }),
  ).toBeInViewport();
  await expect(
    choosePlants.getByRole('button', { name: 'Save and improve plan' }),
  ).toBeInViewport();
  const locationReason = choosePlants
    .getByRole('button', { name: /plot fit reason/i })
    .first();

  await locationReason.focus();
  await expect(choosePlants.getByRole('tooltip').first()).toBeVisible();
  await expect(choosePlants.getByRole('tooltip').first()).not.toHaveText('');
  await choosePlants
    .getByRole('button', { name: 'Close choose plants' })
    .click();
  await expect(choosePlants).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Plan' })).toBeVisible();

  await openPlanTool(page, 'Plant');
  const planContextPanel = page.getByLabel('Plan context panel');

  await expect(planContextPanel).toBeVisible({ timeout: 15_000 });
  await planContextPanel
    .getByRole('button', { name: 'Open plant picker' })
    .click({ force: true });
  const addPlant = page.getByRole('dialog', { name: 'Add Plant' });

  await expect(addPlant).toBeVisible();
  await expect(
    addPlant.getByRole('button', { name: 'Cancel' }),
  ).toBeInViewport();
  await expect(
    addPlant.getByRole('button', { name: 'Add plant' }),
  ).toBeInViewport();
});

test('generated layouts open a visual walkthrough without certainty copy', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1365, height: 768 });
  await signInWithMockPassword(page);
  await addTomatoToSeasonList(page);

  await openPlanTool(page, 'Generated layouts');
  await expect(
    page.getByRole('heading', { name: 'Review problems' }),
  ).toBeVisible();
  const beforeAfterPreview = page.getByRole('region', {
    name: 'Before and after preview',
  });

  if (!(await beforeAfterPreview.isVisible().catch(() => false))) {
    await page
      .getByRole('button', { name: /Generate layouts|Refresh layouts/ })
      .first()
      .click();
  }

  const walkthrough = page.getByRole('region', {
    name: 'Generated layouts',
  });

  await expect(
    walkthrough.getByRole('heading', {
      exact: true,
      name: 'Try a different arrangement',
    }),
  ).toBeVisible();
  await expect(beforeAfterPreview).toBeVisible();
  await expect(page.getByLabel(/Layout diff overlay/)).toBeVisible();
  await expect(page.locator('body')).not.toContainText('Fit confidence');
});

test('Feed compose launcher exposes explicit private memory actions only', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 780 });
  await signInWithMockPassword(page);
  await page.goto('/app/feed');

  await expect(page.getByRole('button', { name: 'New entry' })).toBeVisible();
  await expect(
    page.getByRole('button', { exact: true, name: 'Post' }),
  ).toHaveCount(0);
  await expect(
    page.getByRole('button', { exact: true, name: 'Photo' }),
  ).toHaveCount(0);
  await expect(page.locator('body')).not.toContainText(/carrier messaging|notification provider/);

  await page.getByRole('button', { name: 'New entry' }).click();
  const composer = page.getByRole('dialog', { name: 'New feed entry' });

  await expect(composer).toBeVisible();
  await expect(
    composer.getByRole('button', { exact: true, name: 'New note' }),
  ).toBeVisible();
  await expect(
    composer.getByRole('button', { exact: true, name: 'New issue' }),
  ).toBeVisible();
  await expect(
    composer.getByRole('button', {
      exact: true,
      name: 'New photo update',
    }),
  ).toBeVisible();
  await expect(
    composer.getByRole('button', { exact: true, name: 'Log harvest' }),
  ).toBeVisible();

  await composer
    .getByRole('button', { exact: true, name: 'New photo update' })
    .click();
  await expect(
    composer.getByRole('button', { name: 'Save photo update' }),
  ).toBeVisible();
});

test('reduced motion keeps Today sheet and Feed composer settled', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 390, height: 780 });
  await signInWithMockPassword(page);
  await enterDemoFromShell(page);

  await page.goto('/app/today');
  await page
    .getByRole('heading', { name: 'Log what happened' })
    .scrollIntoViewIfNeeded();
  await page.getByText('Field entry').click();
  await page.getByRole('button', { name: 'Add note' }).click();
  const todaySheet = page.getByRole('dialog', { name: 'Add note' });

  await expect(todaySheet).toBeVisible();
  await expect(todaySheet.locator('[data-action-kind="note"]')).toBeVisible();
  await expect(todaySheet).toHaveCSS('transform', 'none');
  await todaySheet.getByRole('button', { name: /Close/ }).click();
  await expect(todaySheet).toHaveCount(0);

  await page.goto('/app/feed');
  await page.getByRole('button', { name: 'New entry' }).click();
  const composer = page.getByRole('dialog', { name: 'New feed entry' });

  await expect(composer).toBeVisible();
  await expect(composer).toHaveCSS('transform', 'none');
  await composer
    .getByRole('button', { exact: true, name: 'New photo update' })
    .click();
  await expect(composer.locator('[data-composer-mode="photo"]')).toBeVisible();
});

test('sample garden tools stay in Settings and do not surface removed scope', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1365, height: 768 });
  await signInWithMockPassword(page);

  await page.getByRole('link', { name: 'Settings' }).click();
  await expect(page.getByTestId('sample-garden-disclosure')).toBeVisible();
  await page.getByTestId('sample-garden-disclosure').locator('summary').click();
  const demoControls = page.getByRole('region', { name: 'Sample garden' });
  await demoControls
    .getByRole('button', { name: 'Open sample garden' })
    .click();
  await expect(demoControls).toContainText('Sample garden active.');

  await expect(
    demoControls.getByRole('button', { name: 'Reset sample garden' }),
  ).toBeVisible();
  await expect(
    demoControls.getByRole('button', { name: 'Return to saved garden' }),
  ).toBeVisible();
  await expect(page.locator('body')).not.toContainText(
    /Fit confidence|carrier messaging|notification provider/,
  );
});

async function readViewportSize(page: Page) {
  return page.getByTestId('plot-viewport').evaluate((viewport) => ({
    height: viewport.clientHeight,
    width: viewport.clientWidth,
  }));
}
