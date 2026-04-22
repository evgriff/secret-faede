import { expect, test, type Page } from '@playwright/test';

import {
  addTomatoToSeasonList,
  enterDemoFromShell,
  openPlanTool,
  signInWithMockPassword,
} from './appSmokeHelpers';

test('quantity-first Add Plant creates individual nodes without resizing the plot', async ({
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
  await expect(addPlant.getByText('Will create 3 plant nodes.')).toBeVisible();
  await addPlant.getByRole('button', { name: 'Add plant' }).click();

  await expect(
    page.getByRole('button', { name: /Tomato 1 at X:/ }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: /Tomato 2 at X:/ }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: /Tomato 3 at X:/ }),
  ).toBeVisible();
  await expect(viewport).toHaveJSProperty('clientWidth', stableSize.width);
  await expect(
    page.getByRole('complementary', { name: 'Crop focus' }),
  ).toBeVisible();

  const focusedSize = await readViewportSize(page);

  expect(focusedSize.height).toBeGreaterThanOrEqual(500);
});

test('generated layouts open a visual walkthrough without certainty copy', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1365, height: 768 });
  await signInWithMockPassword(page);
  await addTomatoToSeasonList(page);

  await page.getByRole('button', { name: 'Optimize' }).first().click();
  await expect(
    page.getByRole('heading', { name: 'Review proposals' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Generate layouts' }).first().click();

  const walkthrough = page.getByRole('region', {
    name: 'Layout walkthrough',
  });

  await expect(walkthrough.getByText('Proposal walkthrough')).toBeVisible();
  await expect(
    page.getByRole('region', { name: 'Before and after preview' }),
  ).toBeVisible();
  await expect(page.getByLabel(/Proposal diff overlay/)).toBeVisible();
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
    .getByRole('heading', { name: 'Quick actions' })
    .scrollIntoViewIfNeeded();
  await page.getByText('Field entry').click();
  await page.getByRole('button', { name: 'Add note' }).click();
  const todaySheet = page.getByRole('region', { name: 'Add note' });

  await expect(todaySheet).toBeVisible();
  await expect(todaySheet).toHaveAttribute('data-action-kind', 'note');
  await expect(todaySheet).toHaveCSS('transform', 'none');
  await todaySheet.getByRole('button', { name: 'Close' }).click();
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

test('demo controls are discoverable and do not surface removed scope', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1365, height: 768 });
  await signInWithMockPassword(page);

  await expect(
    page
      .getByLabel('Demo controls')
      .getByRole('button', { name: 'Enter demo' }),
  ).toBeVisible();
  await expect(
    page.getByLabel('Demo controls').getByText('Real garden'),
  ).toBeVisible();
  await enterDemoFromShell(page);

  const demoControls = page.getByLabel('Demo controls');

  await expect(
    demoControls.getByRole('button', { name: 'Reset seeded demo' }),
  ).toBeVisible();
  await expect(
    demoControls.getByRole('button', { name: 'Exit demo' }),
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
