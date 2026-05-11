import { expect, test, type Page } from '@playwright/test';

test('Feed issues sync live between Primary Gardener and Partner Gardener with author labels', async ({
  context,
  page: primaryPage,
}) => {
  await primaryPage.setViewportSize({ width: 1365, height: 768 });
  await signInWithSessionOnly(primaryPage, 'primary.gardener@example.com', {
    clearAllStorage: true,
  });
  await primaryPage.getByRole('link', { name: 'Feed' }).click();
  await expect(
    primaryPage.getByRole('heading', { exact: true, name: 'Feed' }),
  ).toBeVisible();

  const partnerPage = await context.newPage();

  await partnerPage.setViewportSize({ width: 1365, height: 768 });
  await signInWithSessionOnly(partnerPage, 'partner.gardener@example.com');
  await partnerPage.getByRole('link', { name: 'Feed' }).click();
  await partnerPage.getByRole('button', { name: 'New entry' }).click();

  const composer = partnerPage.getByRole('dialog', { name: 'New feed entry' });

  await composer
    .getByRole('button', { exact: true, name: 'New issue' })
    .click();
  await partnerPage.getByLabel('Title').fill('Shared slug issue');
  await partnerPage
    .getByLabel('Notes')
    .fill('Partner Gardener saw slug pressure under the lettuce leaves.');
  await composer.getByRole('button', { name: 'Create issue task' }).click();
  await expect(composer).toHaveCount(0);

  const primaryIssue = primaryPage
    .locator('article[id^="feed-journal-"]')
    .filter({ hasText: 'Shared slug issue' })
    .first();

  await expect(primaryIssue).toBeVisible();
  await expect(primaryIssue).toContainText('Partner Gardener');
  await primaryIssue.getByRole('button', { name: 'Resolved' }).click();

  const partnerIssue = partnerPage
    .locator('article[id^="feed-journal-"]')
    .filter({ hasText: 'Shared slug issue' })
    .first();

  await expect(partnerIssue).toContainText('Resolved');
  await expect(
    partnerIssue.getByRole('button', { name: 'Resolved' }),
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
