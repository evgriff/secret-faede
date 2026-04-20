import { expect, test, type Page } from '@playwright/test';

async function signInWithMockLink(page: Page) {
  await page.goto('/');
  await expect(
    page.getByRole('heading', { name: 'Sign in with an email link.' }),
  ).toBeVisible();
  await page.getByLabel('Email').fill('primary.gardener@example.com');
  await page.getByRole('button', { name: 'Send sign-in link' }).click();
  await page.getByRole('link', { name: 'Use mock sign-in link' }).click();
  await expect(
    page.getByRole('heading', {
      name: 'Garden editor',
    }),
  ).toBeVisible();
}

test('allowlisted mock sign-in reaches and saves the garden editor', async ({
  page,
}) => {
  await signInWithMockLink(page);
  await expect(page.getByText('12 ft by 8 ft')).toBeVisible();

  await page.getByRole('button', { exact: true, name: 'Add' }).click();
  await page.getByRole('searchbox', { name: 'Search crops' }).fill('tomato');
  await page.getByRole('button', { exact: true, name: 'Tomato crop' }).click();
  await page.getByRole('button', { name: 'Add plant' }).click();
  await expect(
    page.getByRole('button', { name: 'Tomato at X: 6.0 ft, Y: 4.0 ft' }),
  ).toBeVisible();
  const plantBox = await page
    .getByRole('button', { name: 'Tomato at X: 6.0 ft, Y: 4.0 ft' })
    .boundingBox();

  if (!plantBox) {
    throw new Error('Expected plant to have a visible bounding box.');
  }

  await page.mouse.move(
    plantBox.x + plantBox.width / 2,
    plantBox.y + plantBox.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(
    plantBox.x + plantBox.width / 2 + 56,
    plantBox.y + plantBox.height / 2 + 28,
  );
  await page.mouse.up();
  await expect(
    page.getByRole('button', { name: /Tomato at X:/ }),
  ).toBeVisible();
  await page
    .getByRole('combobox', { name: 'Structure type' })
    .selectOption('trellis');
  await page.getByRole('button', { name: 'Add structure' }).click();
  await expect(
    page.getByRole('button', { name: 'Trellis at X: 1.0 ft, Y: 1.0 ft' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText('Saved', { exact: true })).toBeVisible();

  await page.reload();
  await expect(
    page.getByRole('button', { name: /Tomato at X:/ }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Trellis at X: 1.0 ft, Y: 1.0 ft' }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Save' })).toHaveCount(0);
});

test('garden plot has exact board sizing and scrolls large plots', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1365, height: 768 });
  await signInWithMockLink(page);

  await expect(page.getByTestId('garden-plot')).toHaveJSProperty(
    'clientWidth',
    384,
  );
  await expect(page.getByTestId('garden-plot')).toHaveJSProperty(
    'clientHeight',
    256,
  );

  const smallViewportWidth = await page
    .getByTestId('plot-viewport')
    .evaluate((viewport): number => viewport.clientWidth);
  const smallShellWidth = await page
    .getByTestId('plot-shell')
    .evaluate((shell): number => shell.clientWidth);

  expect(smallShellWidth).toBeLessThan(smallViewportWidth);
  expect(smallShellWidth).toBeGreaterThan(
    await page
      .getByTestId('garden-plot')
      .evaluate((plot): number => plot.clientWidth),
  );

  await page.setViewportSize({ width: 512, height: 768 });
  await page.reload();
  await expect(page.getByTestId('garden-plot')).toHaveJSProperty(
    'clientWidth',
    384,
  );
  await expect(page.getByTestId('garden-plot')).toHaveJSProperty(
    'clientHeight',
    256,
  );

  await page.getByRole('button', { name: 'Plot' }).click();
  await page.getByLabel('Width in feet').fill('60');
  await page.getByLabel('Depth in feet').fill('20');
  await page.getByLabel('Depth in feet').press('Enter');

  await expect(page.getByTestId('garden-plot')).toHaveJSProperty(
    'clientWidth',
    1920,
  );
  const largePlotWidth = await page
    .getByTestId('garden-plot')
    .evaluate((plot): number => plot.clientWidth);
  const largeShellWidth = await page
    .getByTestId('plot-shell')
    .evaluate((shell): number => shell.clientWidth);
  const largeViewport = await page.getByTestId('plot-viewport').evaluate(
    (
      viewport,
    ): {
      clientWidth: number;
      scrollWidth: number;
    } => ({
      clientWidth: viewport.clientWidth,
      scrollWidth: viewport.scrollWidth,
    }),
  );

  expect(largePlotWidth).toBe(1920);
  expect(largeShellWidth).toBeGreaterThan(largePlotWidth);
  expect(largeViewport.scrollWidth).toBeGreaterThan(largeViewport.clientWidth);
});

test('non-allowlisted mock sign-in lands on access denied', async ({
  page,
}) => {
  await page.goto('/');

  await page.getByLabel('Email').fill('blocked@example.com');
  await page.getByRole('button', { name: 'Send sign-in link' }).click();
  await page.getByRole('link', { name: 'Use mock sign-in link' }).click();

  await expect(
    page.getByRole('heading', {
      name: 'This email address is not authorized.',
    }),
  ).toBeVisible();
});
