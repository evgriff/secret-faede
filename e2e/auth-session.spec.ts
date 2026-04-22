import { expect, test } from '@playwright/test';

import { signInWithMockPassword } from './appSmokeHelpers';

test('remembered mock session returns directly to the last workspace route', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1365, height: 768 });
  await signInWithMockPassword(page);
  await page.getByRole('link', { name: 'Today' }).click();
  await expect(
    page.getByRole('heading', {
      exact: true,
      name: 'Today',
    }),
  ).toBeVisible();

  await page.goto('/');

  await expect(
    page.getByRole('heading', {
      exact: true,
      name: 'Today',
    }),
  ).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Sign in' })).toHaveCount(0);
});
