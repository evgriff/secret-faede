import { expect, test } from '@playwright/test';

test('mock sign-in and garden selection reaches the garden shell', async ({
  page,
}) => {
  await page.goto('/');

  await expect(
    page.getByRole('heading', { name: 'Sign in with an email link.' }),
  ).toBeVisible();

  await page.getByLabel('Email').fill('gardener@example.com');
  await page.getByRole('button', { name: 'Send sign-in link' }).click();
  await page.getByRole('link', { name: 'Use mock sign-in link' }).click();

  await expect(
    page.getByRole('heading', {
      name: 'Choose the garden context for this session.',
    }),
  ).toBeVisible();

  await page.getByRole('button', { name: 'Select garden' }).first().click();

  await expect(page.getByRole('heading', { name: 'North Lot' })).toBeVisible();
});
