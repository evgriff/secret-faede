import { expect, type Page } from '@playwright/test';

export async function signInToFirstRunSetup(
  page: Page,
  email = 'primary.gardener@example.com',
) {
  await page.goto('/');
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  await page.context().clearCookies();
  await page.goto('/sign-in');
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
}

export async function signInWithMockPassword(
  page: Page,
  email = 'primary.gardener@example.com',
) {
  await signInToFirstRunSetup(page, email);
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

  const sampleGarden = page.getByRole('region', { name: 'Sample garden' });

  await expect(sampleGarden).toBeVisible();
  await expect(sampleGarden).toContainText('Sample garden active.');
  await page.getByRole('link', { exact: true, name: 'Plan' }).click();
  await expect(
    page.getByRole('heading', { exact: true, name: 'Plan' }),
  ).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText('20 ft by 16 ft')).toBeVisible();
}

export async function expectSampleGardenSettings(page: Page) {
  await expect(
    page.getByRole('region', { name: 'Sample garden' }),
  ).toContainText('Sample garden active.');
  await expect(page.getByLabel('Watering check time')).toHaveValue('07:15');
  const recentAlertsDisclosure = page
    .locator('details')
    .filter({ has: page.locator('summary', { hasText: 'Recent alerts' }) })
    .first();
  const activeAlerts = recentAlertsDisclosure.getByLabel('Active alerts');

  if (!(await activeAlerts.isVisible().catch(() => false))) {
    await recentAlertsDisclosure.locator('summary').click();
  }

  await expect(
    activeAlerts.getByRole('heading', {
      name: 'Water roots and salad bed today',
    }),
  ).toBeVisible();
}

export async function resetAndExitSampleGarden(page: Page) {
  await openSampleGardenDisclosure(page);
  const demoPanel = page.getByRole('region', { name: 'Sample garden' });

  await demoPanel.getByRole('button', { name: 'Reset sample garden' }).click();
  await expect(page.getByText('Sample garden reset.')).toBeVisible();
  await expect(page.getByLabel('Watering check time')).toHaveValue('07:15');
  await demoPanel.getByRole('button', { name: 'Back to my garden' }).click();
  await expect(page.getByText('Returned to your garden.')).toHaveCount(1);
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

  await expect(toolButton).toBeVisible();
  await toolButton.click();
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
  await expandPickedPlants(page);
  await expect(
    page.getByRole('region', { name: 'Season crop board' }),
  ).toContainText('Tomato');
  await page.getByRole('button', { name: 'Save list' }).click();
  await expect(page.getByRole('dialog', { name: 'Choose Plants' })).toHaveCount(
    0,
  );
}

export async function expandPickedPlants(page: Page) {
  const expandButton = page.getByRole('button', {
    name: 'Expand picked plants',
  });
  const seasonBoardTab = page.getByRole('tab', { name: 'Picked' });

  if (await expandButton.isVisible().catch(() => false)) {
    await expandButton.click();
    return;
  }

  if (await seasonBoardTab.isVisible().catch(() => false)) {
    await seasonBoardTab.click();
  }
}

export async function generateAndApplyFirstLayout(page: Page) {
  await openPlanTool(page, 'Generate layout');
  await expect(
    page.getByRole('heading', { name: 'Review problems' }),
  ).toBeVisible();
  const preview = page.getByRole('region', {
    name: 'Before and after preview',
  });

  if (!(await preview.isVisible().catch(() => false))) {
    await page
      .getByRole('button', { name: /Generate layout|Check again/ })
      .first()
      .click();
  }

  const layoutWalkthrough = page.getByRole('region', {
    name: 'Layout suggestion',
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
