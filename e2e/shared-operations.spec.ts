import { expect, test, type Page } from '@playwright/test';

test('Feed issues sync live between Primary Gardener and Partner Gardener with author labels', async ({
  context,
  page: evanPage,
}) => {
  await evanPage.setViewportSize({ width: 1365, height: 768 });
  await signInWithSessionOnly(evanPage, 'primary.gardener@example.com', {
    clearAllStorage: true,
  });
  await evanPage.getByRole('link', { name: 'Feed' }).click();
  await expect(
    evanPage.getByRole('heading', { exact: true, name: 'Feed' }),
  ).toBeVisible();

  const emmaPage = await context.newPage();

  await emmaPage.setViewportSize({ width: 1365, height: 768 });
  await signInWithSessionOnly(emmaPage, 'partner.gardener@example.com');
  await emmaPage.getByRole('link', { name: 'Feed' }).click();
  await emmaPage.getByRole('button', { name: 'New entry' }).click();

  const composer = emmaPage.getByRole('dialog', { name: 'New feed entry' });

  await composer
    .getByRole('button', { exact: true, name: 'New issue' })
    .click();
  await emmaPage.getByLabel('Title').fill('Shared slug issue');
  await emmaPage
    .getByLabel('Notes')
    .fill('Partner Gardener saw slug pressure under the lettuce leaves.');
  await composer.getByRole('button', { name: 'Create issue task' }).click();
  await expect(composer).toHaveCount(0);

  const evanIssue = evanPage
    .locator('article[id^="feed-journal-"]')
    .filter({ hasText: 'Shared slug issue' })
    .first();

  await expect(evanIssue).toBeVisible();
  await expect(evanIssue).toContainText('Partner Gardener');
  await evanIssue.getByRole('button', { name: 'Resolved' }).click();

  const emmaIssue = emmaPage
    .locator('article[id^="feed-journal-"]')
    .filter({ hasText: 'Shared slug issue' })
    .first();

  await expect(emmaIssue).toContainText('Resolved');
  await expect(
    emmaIssue.getByRole('button', { name: 'Resolved' }),
  ).toHaveAttribute('aria-pressed', 'true');
});

async function signInWithSessionOnly(
  page: Page,
  email: string,
  options: { clearAllStorage?: boolean } = {},
) {
  await page.goto('/');
  await page.evaluate((clearAllStorage) => {
    if (clearAllStorage) {
      localStorage.clear();
    }

    sessionStorage.clear();
  }, options.clearAllStorage ?? false);
  await page.context().clearCookies();
  await page.goto('/sign-in');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password', { exact: true }).fill('password');

  const rememberDevice = page.getByRole('checkbox', {
    name: 'Stay signed in on this trusted device',
  });

  if (await rememberDevice.isChecked()) {
    await rememberDevice.uncheck();
  }

  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(
    page.getByRole('navigation', { name: 'Workspace' }),
  ).toBeVisible();
}
