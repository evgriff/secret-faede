import { expect, test } from '@playwright/test';

import { primaryEmail, resetBrowserState, signIn } from './appSmokeHelpers';

test.describe('authentication and session routing', () => {
  test('guards a deep link, resumes it after sign-in, and remembers the last route', async ({
    page,
  }) => {
    await resetBrowserState(page);
    await page.goto('/app/today?focus=watering');
    await expect(
      page.getByRole('heading', { name: 'Open the field book' }),
    ).toBeVisible();

    await page.getByLabel('Email').fill(primaryEmail);
    await page.getByLabel(/^Password/).fill('password');
    await page.getByRole('button', { name: 'Sign in' }).click();

    await expect(page).toHaveURL(/\/app\/today\?focus=watering$/);
    await expect(
      page.getByRole('heading', { exact: true, level: 1, name: 'Today' }),
    ).toBeVisible();
    await page
      .getByRole('navigation', { name: 'Garden workspace' })
      .getByRole('link', { exact: true, name: 'Feed' })
      .filter({ visible: true })
      .click();
    await expect(
      page.getByRole('heading', { exact: true, level: 1, name: 'Feed' }),
    ).toBeVisible();

    await page.goto('/');
    await expect(page).toHaveURL(/\/app\/feed$/);
    await expect(
      page.getByRole('heading', { exact: true, level: 1, name: 'Feed' }),
    ).toBeVisible();

    await page.getByRole('button', { name: 'Sign out' }).click();
    await expect(
      page.getByRole('heading', { name: 'Open the field book' }),
    ).toBeVisible();
  });

  test('keeps an untrusted tab session out of a new tab', async ({
    context,
    page,
  }) => {
    await signIn(page, { remember: false });
    await expect(
      page.getByRole('navigation', { name: 'Garden workspace' }).first(),
    ).toBeVisible();

    const secondTab = await context.newPage();
    await secondTab.goto('/app/plan');
    await expect(
      secondTab.getByRole('heading', { name: 'Open the field book' }),
    ).toBeVisible();
  });

  test('rejects an email outside the two-account allowlist without authenticating', async ({
    page,
  }) => {
    await resetBrowserState(page);
    await page.getByLabel('Email').fill('visitor@example.com');
    await page.getByLabel(/^Password/).fill('password');
    await page.getByRole('button', { name: 'Sign in' }).click();

    await expect(
      page.getByText(
        'This email is not one of the two configured garden accounts.',
      ),
    ).toBeVisible();
    await expect(page).toHaveURL(/\/sign-in$/);
  });

  test('closes a persisted session that no longer has workspace access', async ({
    page,
  }) => {
    await page.addInitScript(() => {
      localStorage.setItem(
        'secret-faeries.auth.mock.session',
        JSON.stringify({
          accessClaims: {
            gardenAccess: false,
            secretFaeriesMember: false,
          },
          displayName: 'Former gardener',
          email: 'former.gardener@example.com',
          provider: 'mock',
          uid: 'mock-former-gardener-example-com',
        }),
      );
    });
    await page.goto('/app/plan');
    await expect(
      page.getByRole('heading', {
        name: 'This account cannot open the garden',
      }),
    ).toBeVisible();
    await expect(page.getByText('former.gardener@example.com')).toBeVisible();
    await page.getByRole('button', { name: 'Return to sign in' }).click();
    await expect(
      page.getByRole('heading', { name: 'Open the field book' }),
    ).toBeVisible();
  });
});
