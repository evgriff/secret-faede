import { expect, test } from '@playwright/test';

import { enterDemoFromShell, signInWithMockPassword } from './appSmokeHelpers';

test('Today surfaces due tasks with reasons and target jumps', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1365, height: 768 });
  await page.clock.setFixedTime(new Date('2026-06-21T14:00:00.000Z'));
  await signInWithMockPassword(page);
  await enterDemoFromShell(page);

  await page.goto('/app/today');
  await expect(page.getByRole('heading', { name: 'Task list' })).toBeVisible();
  await expect(
    page.getByText('Water roots and salad bed 0.35 in').first(),
  ).toBeVisible();
  await expect(
    page
      .getByText('Spring greens bed is below its weekly water target.')
      .first(),
  ).toBeVisible();
  await expect(
    page.getByText('Harvest largest radishes').first(),
  ).toBeVisible();
  const radishHarvest = page
    .locator('article')
    .filter({ has: page.getByRole('button', { name: 'Not ready' }) })
    .filter({ hasText: 'French breakfast radish' })
    .first();
  await expect(
    radishHarvest.getByRole('button', { name: 'Log harvest' }),
  ).toBeVisible();
  const doNow = page
    .locator('section')
    .filter({ has: page.getByRole('heading', { name: /field priorities/ }) })
    .first();
  await expect(
    doNow.getByRole('button', { name: 'Water done' }).first(),
  ).toHaveAttribute('data-ui', 'action');
  await expect(
    doNow.locator('[data-ui="status"]').filter({ hasText: 'Water done' }),
  ).toHaveCount(0);
  await doNow.getByRole('button', { name: 'Water done' }).first().click();
  await expect(page.getByRole('region', { name: 'Add photo' })).toHaveCount(0);

  await page
    .locator('article')
    .filter({ hasText: 'Check French breakfast radish seedlings' })
    .getByRole('link', { name: 'Plan' })
    .first()
    .click();
  await expect(page).toHaveURL('/app/plan?p=demo-radish-row');
  await expect(
    page.getByRole('heading', { exact: true, name: 'Plan' }),
  ).toBeVisible();
  await expect(
    page.getByRole('complementary', { name: 'Crop focus' }),
  ).toContainText('French breakfast radish');

  await page.getByRole('link', { exact: true, name: 'Today' }).click();
  await radishHarvest.getByRole('button', { name: 'Not ready' }).click();
  await radishHarvest.getByRole('button', { name: '3 days' }).click();
  await expect(radishHarvest).toBeHidden();
  await expect(
    page.getByRole('button', { name: 'Task done' }).first(),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Snooze' }).first(),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Defer' }).first(),
  ).toBeVisible();

  await page.getByRole('button', { name: /Jun 24/ }).click();
  await expect(
    page
      .locator('article')
      .filter({ has: page.getByRole('button', { name: 'Not ready' }) })
      .filter({ hasText: 'French breakfast radish' })
      .first(),
  ).toBeVisible();
  await page.getByRole('button', { name: /Jun 22/ }).click();
  await expect(
    page.getByText('Inspect lettuce for slug pressure').first(),
  ).toBeVisible();
  await page
    .locator('article')
    .filter({ hasText: 'Inspect lettuce for slug pressure' })
    .getByRole('link', { name: 'Feed' })
    .first()
    .click();
  await expect(page).toHaveURL('/app/feed?entry=journal-demo-issue-slugs');
  await expect(
    page.getByRole('heading', {
      exact: true,
      name: 'Slug pressure in lettuce',
    }),
  ).toBeVisible();
  await page
    .locator('#feed-journal-demo-issue-slugs')
    .getByRole('link', { name: 'Butterhead lettuce' })
    .click();
  await expect(page).toHaveURL('/app/plan?p=demo-lettuce-block');
  await expect(
    page.getByRole('complementary', { name: 'Crop focus' }),
  ).toContainText('lettuce');
});

test('Today logs a harvest from the field card with one tap', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.clock.setFixedTime(new Date('2026-06-21T14:00:00.000Z'));
  await signInWithMockPassword(page);
  await enterDemoFromShell(page);

  await page.goto('/app/today');
  const radishHarvest = page
    .locator('article')
    .filter({ has: page.getByRole('button', { name: 'Not ready' }) })
    .filter({ hasText: 'French breakfast radish' })
    .first();

  await radishHarvest.getByRole('button', { name: 'Log harvest' }).click();

  await expect(page.getByText('Harvest logged: Picked')).toBeVisible();
  await expect(
    page.getByText('Task done: Harvest largest radishes'),
  ).toBeVisible();
  await expect(page.getByRole('region', { name: 'Add photo' })).toBeVisible();
  await expect(radishHarvest).toContainText('French breakfast radish');
});
