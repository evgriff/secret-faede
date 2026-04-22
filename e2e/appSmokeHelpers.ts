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

export async function enterDemoFromShell(page: Page) {
  await page.getByRole('button', { name: 'Enter demo' }).click();

  await expect(
    page.getByLabel('Demo controls').getByRole('button', { name: 'Exit demo' }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { exact: true, name: 'Plan' }),
  ).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText('20 ft by 16 ft')).toBeVisible();
}

export async function expectSampleSettings(page: Page) {
  await expect(
    page.getByRole('region', { name: 'sample garden' }),
  ).toContainText('Demo workspace active.');
  await expect(page.getByLabel('Watering check time')).toHaveValue('07:15');
  await expect(
    page
      .getByLabel('Active alerts')
      .getByRole('heading', { name: 'Water roots and salad bed today' }),
  ).toBeVisible();
}

export async function resetAndExitSample(page: Page) {
  const demoPanel = page.getByRole('region', { name: 'sample garden' });

  await demoPanel.getByRole('button', { name: 'Reset seeded demo' }).click();
  await expect(page.getByText('Seeded demo reset.')).toBeVisible();
  await expect(page.getByLabel('Watering check time')).toHaveValue('07:15');
  await demoPanel.getByRole('button', { name: 'Exit demo' }).click();
  await expect(page.getByText('Real garden restored.')).toBeVisible();
}

export async function savePlan(page: Page) {
  await page.getByRole('button', { name: 'Save' }).first().click();
}

export async function openPlanTool(page: Page, name: string) {
  await page.getByRole('button', { name: 'Open Plan tools' }).click();
  const launcher = page.getByLabel('Plan tool launcher');

  await expect(launcher).toBeVisible();
  await launcher.getByRole('button', { exact: true, name }).click();
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
  const layoutWalkthrough = page.getByRole('region', {
    name: 'Layout walkthrough',
  });
  await expect(
    layoutWalkthrough.getByText('Proposal walkthrough'),
  ).toBeVisible();
  await expect(
    page.getByRole('region', { name: 'Before and after preview' }),
  ).toBeVisible();
  await expect(page.getByLabel(/Proposal diff overlay/)).toBeVisible();
  await layoutWalkthrough
    .getByRole('button', { name: 'Snooze selected proposal' })
    .click();
  await expect(
    layoutWalkthrough.getByRole('button', { name: /Snoozed/ }),
  ).toBeVisible();
  await layoutWalkthrough
    .getByRole('button', { name: 'Reject selected proposal' })
    .click();
  await expect(
    layoutWalkthrough.getByText('Rejected', { exact: true }),
  ).toBeVisible();
  await layoutWalkthrough
    .getByRole('button', { name: 'Apply selected proposal to draft' })
    .click();
}
