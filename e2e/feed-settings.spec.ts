import { Buffer } from 'node:buffer';

import { expect, test, type Page } from '@playwright/test';

import {
  addCropGroup,
  createGarden,
  openWorkspaceRoute,
  publishDraft,
  saveDraft,
} from './appSmokeHelpers';

const tomatoTargetLabel = 'Tomato in Raised bed';

test.describe('private Feed', () => {
  test('records note, issue, harvest, and watering history with useful filters', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await createGarden(page, { name: 'Field history garden' });
    await addCropGroup(page, 'Tomato', {
      growingArea: 'Raised bed',
      lifecycle: 'Growing',
    });
    await saveDraft(page);
    await publishDraft(page, 'Publish crop for field history');

    await openWorkspaceRoute(page, 'Today');
    const tomatoCard = page.getByRole('article', {
      name: tomatoTargetLabel,
    });
    await tomatoCard
      .getByRole('button', { name: 'Log watering decision' })
      .click();
    const watering = page.getByRole('dialog', { name: 'Log watering' });
    await watering.getByRole('radio', { name: /^Skipped/ }).check();
    await watering.getByLabel('Why was it skipped?').fill('Rain arrived early');
    await watering.getByRole('button', { name: 'Save decision' }).click();

    await openWorkspaceRoute(page, 'Feed');
    await createMemory(page, {
      body: 'Checked lower leaves and tied the newest stem.',
      mode: 'Note',
      title: 'Morning tomato check',
    });
    await createMemory(page, {
      body: 'Two leaves show small chewing holes.',
      mode: 'Issue',
      title: 'Leaf damage to inspect',
    });
    await createHarvest(page);
    await createPhotoUpdate(page);

    await expect(page.locator('[data-activity-type="note"]')).toContainText(
      'Morning tomato check',
    );
    const issueCard = page
      .locator('[data-activity-type="issue"]')
      .filter({ hasText: 'Leaf damage to inspect' });
    await expect(issueCard).toBeVisible();
    await issueCard.getByRole('button', { name: 'Resolved' }).click();
    await expect(
      issueCard.getByRole('button', { name: 'Resolved' }),
    ).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('[data-activity-type="harvest"]')).toContainText(
      'Harvested Tomato',
    );
    await expect(
      page
        .locator('[data-activity-type="photo"]')
        .getByRole('img', { name: 'tomato-check.png' }),
    ).toBeVisible();
    await expect(page.locator('[data-activity-type="watering"]')).toContainText(
      'Skipped watering for Tomato',
    );

    await page.getByLabel('Type').selectOption({ label: 'Watering' });
    await page.getByLabel('Status').selectOption({ label: 'Water skipped' });
    await expect(page.locator('[data-activity-type="watering"]')).toHaveCount(
      1,
    );
    await expect(page.locator('[data-activity-type="note"]')).toHaveCount(0);

    await page.getByRole('button', { name: 'Clear filters' }).click();
    await page.getByLabel('Type').selectOption({ label: 'Issues' });
    await page.getByLabel('Status').selectOption({ label: 'Resolved' });
    await expect(issueCard).toBeVisible();
    await expect(page.locator('[data-activity-type="harvest"]')).toHaveCount(0);

    await page.getByRole('button', { name: 'Clear filters' }).click();
    await page.getByLabel('Type').selectOption({ label: 'Harvests' });
    await page.getByLabel('Target').selectOption({ label: tomatoTargetLabel });
    await expect(page.locator('[data-activity-type="harvest"]')).toHaveCount(1);
  });
});

test.describe('garden and notification Settings', () => {
  test('focuses validation errors, persists valid climate inputs, and reports consent truthfully', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1180, height: 900 });
    await createGarden(page, {
      name: 'Settings garden',
      template: 'Blank plot',
    });
    await openWorkspaceRoute(page, 'Settings');

    const identity = page.getByRole('region', { name: 'Signed-in identity' });
    await expect(
      identity.getByText('Primary Gardener', { exact: true }),
    ).toBeVisible();
    await expect(
      identity.getByText('primary.gardener@example.com', { exact: true }),
    ).toBeVisible();
    await expect(page.getByText('Push is not active')).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Enable push on this device' }),
    ).toBeDisabled();
    await expect(page.getByText('Push', { exact: true }).last()).toBeVisible();
    await expect(
      page.getByText('Unsupported', { exact: true }).last(),
    ).toBeVisible();

    await page.getByLabel('Location label').fill('Detroit backyard');
    await page.getByLabel('Weather location').fill('48201');
    await page.getByLabel('Garden timezone').fill('Not/A_Timezone');
    await page.getByLabel('Latitude').fill('42.3314');
    await page.getByLabel('Hardiness zone').fill('99z');
    await page.getByLabel('Minimum watering deficit').fill('0');
    await page.getByRole('button', { name: 'Save settings' }).click();

    await expect(
      page.getByText('Review the highlighted settings'),
    ).toBeVisible();
    await expect(
      page.getByText('Enter both coordinates for operational weather.'),
    ).toHaveCount(2);
    await expect(page.getByText(/valid IANA timezone/)).toBeVisible();
    await expect(page.getByLabel('Garden timezone')).toBeFocused();

    await page.getByLabel('Garden timezone').fill('America/Detroit');
    await page.getByLabel('Longitude').fill('-83.0458');
    await page.getByLabel('Hardiness zone').fill('6b');
    await page.getByLabel('Typical last frost').fill('05-05');
    await page.getByLabel('Typical first frost').fill('10-20');
    await page.getByLabel('Daily watering check').fill('06:45');
    await page.getByLabel('Quiet hours start').fill('21:30');
    await page.getByLabel('Quiet hours end').fill('06:15');
    await page.getByLabel('Minimum watering deficit').fill('0.3');
    await page.getByRole('checkbox', { name: /^Watering/ }).uncheck();
    await page.getByRole('button', { name: 'Save settings' }).click();
    await expect(page.getByText('Settings saved').first()).toBeVisible();

    await page.reload();
    await expect(page.getByLabel('Garden timezone')).toHaveValue(
      'America/Detroit',
    );
    await expect(page.getByLabel('Latitude')).toHaveValue('42.3314');
    await expect(page.getByLabel('Longitude')).toHaveValue('-83.0458');
    await expect(page.getByLabel('Daily watering check')).toHaveValue('06:45');
    await expect(
      page.getByRole('checkbox', { name: /^Watering/ }),
    ).not.toBeChecked();
    await expect(page.getByText('Push is not active')).toBeVisible();
  });
});

async function createMemory(
  page: Page,
  input: { body: string; mode: 'Issue' | 'Note'; title: string },
) {
  await page.getByRole('button', { name: 'New entry' }).click();
  const dialog = page.getByRole('dialog', { name: 'New entry' });
  await dialog.getByRole('button', { name: input.mode, exact: true }).click();
  await dialog
    .getByLabel('Garden target')
    .selectOption({ label: tomatoTargetLabel });
  await dialog.getByLabel('Title').fill(input.title);
  await dialog.getByLabel('Details').fill(input.body);
  if (input.mode === 'Issue') {
    await dialog.getByLabel('Severity').selectOption({ label: 'High' });
  }
  await dialog
    .getByRole('button', {
      name: input.mode === 'Issue' ? 'Create issue' : 'Save note',
    })
    .click();
  await expect(dialog).toHaveCount(0);
}

async function createHarvest(page: Page) {
  await page.getByRole('button', { name: 'New entry' }).click();
  const dialog = page.getByRole('dialog', { name: 'New entry' });
  await dialog.getByRole('button', { name: 'Harvest', exact: true }).click();
  await dialog
    .getByLabel('Crop group')
    .selectOption({ label: tomatoTargetLabel });
  await dialog.getByRole('spinbutton', { name: 'Amount' }).fill('5');
  await dialog.getByRole('button', { name: 'Log harvest' }).click();
  await expect(dialog).toHaveCount(0);
}

async function createPhotoUpdate(page: Page) {
  await page.getByRole('button', { name: 'New entry' }).click();
  const dialog = page.getByRole('dialog', { name: 'New entry' });
  await dialog
    .getByRole('button', { name: 'Photo update', exact: true })
    .click();
  await dialog
    .getByLabel('Garden target')
    .selectOption({ label: tomatoTargetLabel });
  await dialog.getByLabel('Title').fill('Tomato canopy photo');
  await dialog.getByLabel('Photos').setInputFiles({
    buffer: Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
      'base64',
    ),
    mimeType: 'image/png',
    name: 'tomato-check.png',
  });
  await dialog.getByRole('button', { name: 'Save photo update' }).click();
  await expect(dialog).toHaveCount(0);
}
