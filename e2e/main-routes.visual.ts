import { expect, test, type Page } from '@playwright/test';

import {
  addCropGroup,
  createGarden,
  fillGardenEnvironment,
  openWorkspaceRoute,
  publishDraft,
  resetBrowserState,
  saveDraft,
  signIn,
} from './appSmokeHelpers';

const visualTime = new Date('2026-07-09T14:00:00.000Z');
const viewports = [
  { height: 768, name: 'desktop', width: 1365 },
  { height: 780, name: 'mobile', width: 390 },
] as const;
const maxDiffPixelRatio = process.env.CI ? 0.08 : 0.01;

for (const viewport of viewports) {
  test(`v2 auth and workspace routes · ${viewport.name}`, async ({ page }) => {
    await prepare(page, viewport);
    await resetBrowserState(page);
    await capture(page, `auth-${viewport.name}.png`);

    if (viewport.name === 'desktop') {
      await signIn(page, { reset: false });
      await expect(
        page.getByRole('dialog', { name: 'Set up your garden' }),
      ).toBeVisible();
      await capture(page, 'first-run-setup-desktop.png');
      const setup = page.getByRole('dialog', { name: 'Set up your garden' });
      await fillGardenEnvironment(setup);
      await setup.getByRole('button', { name: 'Create garden plan' }).click();
    } else {
      await createGarden(page, { name: 'Visual garden' });
    }

    if (viewport.name === 'desktop') {
      await expect(
        page.getByRole('heading', { name: 'Home garden' }),
      ).toBeVisible();
    }
    await addCropGroup(page, 'Tomato', {
      growingArea: 'Raised bed',
      lifecycle: 'Growing',
    });
    await saveDraft(page);
    await publishDraft(page, `Publish ${viewport.name} visual garden`);
    await capture(page, `plan-${viewport.name}.png`);

    for (const route of ['Today', 'Feed', 'Settings'] as const) {
      await openWorkspaceRoute(page, route);
      await capture(page, `${route.toLowerCase()}-${viewport.name}.png`);
    }
  });

  test(`v2 Plan overlays · ${viewport.name}`, async ({ page }) => {
    await prepare(page, viewport);
    await createGarden(page, {
      name: 'Visual plot',
      template: 'Blank plot',
    });
    await page.getByRole('button', { name: 'Add crop' }).click();
    await capture(page, `add-plant-${viewport.name}.png`);
    await page
      .getByRole('dialog', { name: 'Add a crop group' })
      .getByRole('button', { name: 'Cancel' })
      .click();

    await addCropGroup(page, 'Tomato', { lifecycle: 'Growing' });
    await page
      .getByRole('button', { name: /Review 1 active plan issue/ })
      .click();
    await capture(page, `review-queue-${viewport.name}.png`);
    await page
      .getByRole('dialog', { name: 'Review plan problems' })
      .getByRole('button', { name: 'Close Review plan problems' })
      .click();

    await page.getByRole('button', { name: 'Suggest layout' }).click();
    await expect(
      page.getByRole('dialog', { name: 'Layout suggestion' }),
    ).toContainText('found no suggested move');
    await capture(page, `optimize-results-${viewport.name}.png`);
  });
}

async function prepare(page: Page, viewport: (typeof viewports)[number]) {
  await page.setViewportSize({
    height: viewport.height,
    width: viewport.width,
  });
  await page.clock.setFixedTime(visualTime);
}

async function capture(page: Page, name: string) {
  await page.evaluate(async () => {
    const main = document.getElementById('main-content');
    if (main) {
      main.scrollLeft = 0;
      main.scrollTop = 0;
    }
    window.scrollTo({ behavior: 'auto', left: 0, top: 0 });
    await document.fonts.ready;
    document.documentElement.dataset.visualTest = 'true';
  });
  await expect.soft(page).toHaveScreenshot(name, {
    animations: 'disabled',
    caret: 'hide',
    maxDiffPixelRatio,
  });
}
