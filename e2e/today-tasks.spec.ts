import { expect, test } from '@playwright/test';

import { signInWithMockPassword } from './appSmokeHelpers';

test('Today surfaces due tasks with reasons and target jumps', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1365, height: 768 });
  await page.clock.setFixedTime(new Date('2026-06-21T14:00:00.000Z'));
  await signInWithMockPassword(page);
  await page.getByRole('link', { name: 'Settings' }).click();
  await page.getByRole('button', { name: 'Load demo garden' }).click();
  await expect(page.getByText('Demo garden loaded.')).toBeVisible();

  await page.getByRole('link', { exact: true, name: 'Today' }).click();
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

  await page.getByRole('link', { name: 'Open plot' }).first().click();
  await expect(page).toHaveURL('/app/plan');
  await expect(
    page.getByRole('heading', { exact: true, name: 'Plan' }),
  ).toBeVisible();

  await page.getByRole('link', { exact: true, name: 'Today' }).click();
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
    .getByRole('link', { name: 'Open feed' })
    .first()
    .click();
  await expect(page).toHaveURL('/app/feed?entry=journal-demo-issue-slugs');
  await expect(
    page.getByRole('heading', {
      exact: true,
      name: 'Slug pressure in lettuce',
    }),
  ).toBeVisible();
});
