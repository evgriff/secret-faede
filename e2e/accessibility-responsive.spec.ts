import { expect, test } from '@playwright/test';

import {
  addCropGroup,
  createGarden,
  expectFocused,
  expectNoHorizontalOverflow,
  openWorkspaceRoute,
} from './appSmokeHelpers';

test.describe('responsive and keyboard smoke', () => {
  test('supports 320px routes without overflow and moves focus on navigation', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 320, height: 760 });
    await createGarden(page, {
      depthFt: 8,
      name: 'Pocket garden',
      template: 'Raised bed',
      widthFt: 12,
    });
    await addCropGroup(page, 'Basil', {
      growingArea: 'Raised bed',
      lifecycle: 'Growing',
    });
    await expectNoHorizontalOverflow(page);

    for (const route of ['Today', 'Feed', 'Settings', 'Plan'] as const) {
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await openWorkspaceRoute(page, route);
      await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
      await expectFocused(page.locator('#main-content'));
      await expectNoHorizontalOverflow(page);
      await expect(
        page
          .getByRole('navigation', { name: 'Garden workspace' })
          .filter({ visible: true }),
      ).toHaveCount(1);
    }
  });

  test('exposes the skip link, traps modal focus, restores the trigger, and nudges in feet', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1000, height: 800 });
    await createGarden(page, {
      name: 'Keyboard garden',
      template: 'Blank plot',
    });

    await page
      .locator('body')
      .evaluate((element) => element.setAttribute('tabindex', '-1'));
    await page.locator('body').focus();
    await page.keyboard.press('Tab');
    const skipLink = page.getByRole('link', { name: 'Skip to main content' });
    await expect(skipLink).toBeFocused();
    await page.keyboard.press('Enter');
    await expectFocused(page.locator('#main-content'));

    const addCrop = page.getByRole('button', { name: 'Add crop' });
    await addCrop.focus();
    await page.keyboard.press('Enter');
    const dialog = page.getByRole('dialog', { name: 'Add a crop group' });
    await expect(dialog).toBeVisible();
    await page.keyboard.press('Shift+Tab');
    await expect
      .poll(() =>
        dialog.evaluate((element) => element.contains(document.activeElement)),
      )
      .toBe(true);
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(addCrop).toBeFocused();

    const basil = await addCropGroup(page, 'Basil', {
      lifecycle: 'Growing',
    });
    const before = await basil.getAttribute('aria-label');
    await basil.focus();
    await page.keyboard.press('ArrowRight');
    await expect(basil).not.toHaveAttribute('aria-label', before ?? '');
    await expect(page.getByText('Unsaved changes').first()).toBeVisible();
  });
});
