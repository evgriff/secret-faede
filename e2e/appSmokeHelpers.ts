import { expect, type Page } from '@playwright/test';

export async function signInWithMockPassword(
  page: Page,
  email = 'primary.gardener@example.com',
) {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password', { exact: true }).fill('password');
  await expect(
    page.getByRole('checkbox', {
      name: 'Stay signed in on this trusted device',
    }),
  ).toBeChecked();
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(
    page.getByRole('heading', { name: 'Set up your garden' }),
  ).toBeVisible();
  await page.getByLabel(/Blank plan/).check();
  await page.getByRole('button', { name: 'Create plan' }).click();
  await expect(
    page.getByRole('heading', {
      exact: true,
      name: 'Plan',
    }),
  ).toBeVisible();
  await savePlan(page);
  await expect(page.getByText('Saved', { exact: true })).toBeVisible();
}

export async function savePlan(page: Page) {
  await page.getByRole('button', { name: 'Save' }).first().click();
}

export async function addTomatoToSeasonList(page: Page) {
  await page.getByRole('button', { name: 'Choose plants' }).first().click();
  await expect(
    page.getByRole('dialog', { name: 'Choose Plants' }),
  ).toBeVisible();
  await page.getByRole('searchbox', { name: 'Search plants' }).fill('tomato');
  await page.getByRole('button', { name: 'Add Tomato' }).click();
  await expect(
    page.getByRole('region', { name: 'Season crop board' }),
  ).toContainText('Tomato');
  await page.getByRole('button', { name: 'Save list' }).click();
  await expect(page.getByRole('dialog', { name: 'Choose Plants' })).toHaveCount(
    0,
  );
}

export async function generateAndApplyFirstLayout(page: Page) {
  await page.getByRole('button', { name: 'Optimize' }).first().click();
  await expect(
    page.getByRole('heading', { name: 'Review proposals' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Generate layouts' }).first().click();
  const layoutCandidates = page.getByRole('region', {
    name: 'Layout candidates',
  });
  await expect(
    layoutCandidates.getByRole('button', { name: 'Preview' }).first(),
  ).toBeVisible();
  await expect(
    page.getByRole('region', { name: 'Before and after preview' }),
  ).toBeVisible();
  await layoutCandidates
    .getByRole('button', { name: 'Preview' })
    .first()
    .click();
  await layoutCandidates
    .getByRole('button', { name: 'Reject selected proposal' })
    .click();
  await expect(
    layoutCandidates.getByText('rejected', { exact: true }),
  ).toBeVisible();
  await layoutCandidates
    .getByRole('button', { name: 'Apply selected proposal to draft' })
    .click();
}
