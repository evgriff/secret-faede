import { expect, test, type Locator, type Page } from '@playwright/test';

import {
  openPlanTool,
  savePlan,
  signInWithMockPassword,
} from './appSmokeHelpers';

test('drag drop autosaves without blocking route navigation', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1365, height: 768 });
  await signInWithMockPassword(page);
  await addTomatoToPlan(page);
  await savePlan(page);
  await expect(page.getByText('Saved', { exact: true })).toBeVisible();
  await expect(
    page.getByRole('complementary', { name: 'Crop focus' }),
  ).toHaveCount(0);

  const plant = page.getByRole('button', {
    name: 'Tomato at X: 6.0 ft, Y: 4.0 ft',
  });
  const plantBox = await getBox(plant, 'Expected tomato to be visible.');

  await page.mouse.move(
    plantBox.x + plantBox.width / 2,
    plantBox.y + plantBox.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(
    plantBox.x + plantBox.width / 2 + 64,
    plantBox.y + plantBox.height / 2 + 32,
    { steps: 4 },
  );
  await page.mouse.up();

  const movedTomato = page
    .getByRole('button', { name: /^Tomato at X:/ })
    .first();

  await expect(movedTomato).toBeVisible();
  await expect(page.getByText('Saved', { exact: true })).toBeVisible();

  await page.getByRole('link', { name: 'Today' }).click();
  await expect(
    page.getByRole('heading', { exact: true, name: 'Today' }),
  ).toBeVisible();
  await page
    .getByRole('navigation', { name: 'Workspace' })
    .getByRole('link', { exact: true, name: 'Plan' })
    .click();
  await expect(
    page.getByRole('heading', { exact: true, name: 'Plan' }),
  ).toBeVisible();
  await expect(movedTomato).toBeVisible();
});

async function addTomatoToPlan(page: Page) {
  await openPlanTool(page, 'Plant');
  await page.getByRole('button', { name: 'Open plant picker' }).click();
  await page.getByRole('searchbox', { name: 'Search crops' }).fill('tomato');
  await page.getByRole('button', { exact: true, name: 'Tomato crop' }).click();
  await page.getByRole('button', { exact: true, name: 'Add plant' }).click();
}

async function getBox(locator: Locator, errorMessage: string) {
  const box = await locator.boundingBox();

  if (!box) {
    throw new Error(errorMessage);
  }

  return box;
}
