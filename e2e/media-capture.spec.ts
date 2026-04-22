import { Buffer } from 'node:buffer';

import { expect, test } from '@playwright/test';

import { signInWithMockPassword } from './appSmokeHelpers';

test('Feed keeps offline photo drafts honest and saves text only', async ({
  context,
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 780 });
  await signInWithMockPassword(page);
  await page.getByRole('link', { name: 'Feed' }).click();
  await expect(
    page.getByRole('heading', { exact: true, name: 'Feed' }),
  ).toBeVisible();

  await context.setOffline(true);
  await page.getByRole('button', { name: 'New entry' }).click();
  const composer = page.getByRole('dialog', { name: 'New feed entry' });

  await expect(composer).toBeVisible();
  await composer.getByLabel('Title').fill('Offline photo draft');
  await composer.getByLabel('Notes').fill('Photo picked while service is out.');
  await composer.getByLabel('Choose or take photo').setInputFiles({
    buffer: Buffer.from(
      'R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==',
      'base64',
    ),
    mimeType: 'image/gif',
    name: 'offline-garden.gif',
  });

  await expect(
    composer.getByRole('img', { name: 'Preview of offline-garden.gif' }),
  ).toBeVisible();
  await expect(
    composer.getByText(/Selected photos stay only in this form/),
  ).toBeVisible();
  await expect(
    composer.getByRole('button', { name: 'Reconnect to upload photos' }),
  ).toBeDisabled();

  await composer
    .getByRole('button', { exact: true, name: 'Save text only' })
    .click();
  await expect(composer).toHaveCount(0);
  await expect(page.getByText('Offline photo draft')).toBeVisible();
  await expect(
    page.getByText('Queued locally', { exact: false }),
  ).toBeVisible();

  await context.setOffline(false);
});
