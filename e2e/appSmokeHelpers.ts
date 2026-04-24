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
  await page.getByRole('link', { name: 'Settings' }).click();
  await openSampleGardenDisclosure(page);
  await page.getByRole('button', { name: 'Open sample garden' }).click();

  await expect(
    page.getByRole('region', { name: 'Sample garden' }),
  ).toBeVisible();
  await expect(page.getByText('Sample garden active.')).toBeVisible();
  await page.getByRole('link', { exact: true, name: 'Plan' }).click();
  await expect(
    page.getByRole('heading', { exact: true, name: 'Plan' }),
  ).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText('20 ft by 16 ft')).toBeVisible();
}

export async function expectSampleSettings(page: Page) {
  await expect(
    page.getByRole('region', { name: 'Sample garden' }),
  ).toContainText('Sample garden active.');
  await expect(page.getByLabel('Watering check time')).toHaveValue('07:15');
  await expect(
    page
      .getByLabel('Active alerts')
      .getByRole('heading', { name: 'Water roots and salad bed today' }),
  ).toBeVisible();
}

export async function resetAndExitSample(page: Page) {
  await openSampleGardenDisclosure(page);
  const demoPanel = page.getByRole('region', { name: 'Sample garden' });

  await demoPanel.getByRole('button', { name: 'Reset sample garden' }).click();
  await expect(page.getByText('Sample garden reset.')).toBeVisible();
  await expect(page.getByLabel('Watering check time')).toHaveValue('07:15');
  await demoPanel
    .getByRole('button', { name: 'Return to saved garden' })
    .click();
  await expect(page.getByText('Saved garden restored.')).toHaveCount(1);
}

export async function savePlan(page: Page) {
  await page.getByRole('button', { name: 'Save' }).first().click();
}

export async function openPlanTool(page: Page, name: string) {
  const launcher = page.locator('[aria-label="More tools menu"]');

  if (!(await launcher.isVisible().catch(() => false))) {
    await page.getByRole('button', { name: 'Open more tools' }).click();
  }

  await expect(launcher).toBeVisible();
  const toolButton = launcher.getByRole('button', { name });

  await toolButton.focus();
  await toolButton.press('Enter');
}

export async function addTomatoToSeasonList(page: Page) {
  await page
    .getByRole('button', { name: /add plants/i })
    .first()
    .click();
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
  await openPlanTool(page, 'Generated layouts');
  await expect(
    page.getByRole('heading', { name: 'Review problems' }),
  ).toBeVisible();
  const preview = page.getByRole('region', {
    name: 'Before and after preview',
  });

  if (!(await preview.isVisible().catch(() => false))) {
    await page
      .getByRole('button', { name: /Generate layouts|Refresh layouts/ })
      .first()
      .click();
  }

  const layoutWalkthrough = page.getByRole('region', {
    name: 'Generated layouts',
  });
  await expect(
    layoutWalkthrough.getByRole('heading', {
      exact: true,
      name: 'Try a different arrangement',
    }),
  ).toBeVisible();
  await expect(preview).toBeVisible();
  await expect(page.getByLabel(/Layout diff overlay/)).toBeVisible();
  await layoutWalkthrough
    .getByRole('button', { name: 'Apply this layout' })
    .click();
}

async function openSampleGardenDisclosure(page: Page) {
  const disclosure = page.getByTestId('sample-garden-disclosure');

  await expect(disclosure).toBeVisible();

  if ((await disclosure.getAttribute('open')) !== null) {
    return;
  }

  await disclosure.locator('summary').click();
}
