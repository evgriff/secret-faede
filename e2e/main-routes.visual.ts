import { expect, test, type Page } from '@playwright/test';

import {
  enterDemoFromShell,
  openPlanTool,
  signInToFirstRunSetup,
} from './appSmokeHelpers';

const visualTime = new Date('2026-06-21T14:00:00.000Z');
const routes = [
  { heading: 'Plan', name: 'plan', nav: 'Plan' },
  { heading: 'Today', name: 'today', nav: 'Today' },
  { heading: 'Feed', name: 'feed', nav: 'Feed' },
  { heading: 'Settings', name: 'settings', nav: 'Settings' },
] as const;
const viewports = [
  { height: 768, name: 'desktop', width: 1365 },
  { height: 780, name: 'mobile', width: 390 },
] as const;
const ciMaxDiffPixelRatio = 0.08;

test.describe('main route visual baselines', () => {
  for (const viewport of viewports) {
    test(`auth ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize({
        height: viewport.height,
        width: viewport.width,
      });
      await page.clock.setFixedTime(visualTime);
      await page.goto('/');
      await expect(
        page.getByRole('heading', { name: 'Sign in' }),
      ).toBeVisible();
      await stabilizeVisualState(page);
      await expect(page).toHaveScreenshot(`auth-${viewport.name}.png`, {
        animations: 'disabled',
        caret: 'hide',
        maxDiffPixelRatio: visualMaxDiffPixelRatio(0.01),
      });
    });
  }

  for (const viewport of viewports) {
    for (const route of routes) {
      test(`${route.name} ${viewport.name}`, async ({ page }) => {
        await page.setViewportSize({
          height: viewport.height,
          width: viewport.width,
        });
        await page.clock.setFixedTime(visualTime);
        await signInAndLoadDemo(page);
        await page.getByRole('link', { exact: true, name: route.nav }).click();
        await expect(
          page.locator('h1', { hasText: route.heading }),
        ).toBeVisible();
        await stabilizeVisualState(page);
        await expect(page).toHaveScreenshot(
          `${route.name}-${viewport.name}.png`,
          {
            animations: 'disabled',
            caret: 'hide',
            maxDiffPixelRatio: visualMaxDiffPixelRatio(0.01),
          },
        );
      });
    }
  }
});

test.describe('Plan workflow visual baselines', () => {
  for (const viewport of viewports) {
    if (viewport.name === 'desktop') {
      test(`first-run setup ${viewport.name}`, async ({ page }) => {
        await setVisualViewport(page, viewport);
        await signInToFirstRunSetup(page);
        await stabilizeVisualState(page);
        await expect(page).toHaveScreenshot(
          `first-run-setup-${viewport.name}.png`,
          {
            animations: 'disabled',
            caret: 'hide',
            maxDiffPixelRatio: visualMaxDiffPixelRatio(0.01),
          },
        );
      });
    }

    test(`add plant ${viewport.name}`, async ({ page }) => {
      await setVisualViewport(page, viewport);
      await signInAndCreateBlankPlan(page);
      await openPlanTool(page, 'Plant');
      await page.getByRole('button', { name: 'Open plant picker' }).click();
      await expect(
        page.getByRole('dialog', { name: 'Add Plant' }),
      ).toBeVisible();
      await stabilizeVisualState(page);
      await expect(page).toHaveScreenshot(`add-plant-${viewport.name}.png`, {
        animations: 'disabled',
        caret: 'hide',
        maxDiffPixelRatio: visualMaxDiffPixelRatio(0.01),
      });
    });

    if (viewport.name === 'desktop') {
      test(`add plant advanced ${viewport.name}`, async ({ page }) => {
        await setVisualViewport(page, viewport);
        await signInAndCreateBlankPlan(page);
        await openPlanTool(page, 'Plant');
        await page.getByRole('button', { name: 'Open plant picker' }).click();
        const addPlant = page.getByRole('dialog', { name: 'Add Plant' });

        await expect(addPlant).toBeVisible();
        await addPlant
          .getByRole('button', { name: 'Advanced filters' })
          .click();
        await expect(
          addPlant.getByRole('combobox', { name: /Growth form/i }),
        ).toBeVisible();
        await stabilizeVisualState(page);
        await expect(page).toHaveScreenshot(
          `add-plant-advanced-${viewport.name}.png`,
          {
            animations: 'disabled',
            caret: 'hide',
            maxDiffPixelRatio: visualMaxDiffPixelRatio(0.01),
          },
        );
      });
    }

    test(`choose plants ${viewport.name}`, async ({ page }) => {
      await setVisualViewport(page, viewport);
      await signInAndCreateBlankPlan(page);
      await openChoosePlants(page);
      await page
        .getByRole('searchbox', { name: 'Search plants' })
        .fill('tomato');
      await expect(
        page.getByRole('button', { name: 'Add Tomato' }),
      ).toBeVisible();
      await page.getByRole('button', { name: 'Add Tomato' }).click();
      if (viewport.name === 'mobile') {
        await page.getByRole('tab', { name: 'Picked' }).click();
        await expect(
          page.getByRole('region', { name: 'Season crop board' }),
        ).toContainText('Tomato');
      } else {
        await expect(
          page.getByRole('button', { name: 'Expand picked plants' }),
        ).toBeVisible();
      }
      await resetChoosePlantsScrollState(page);
      await stabilizeVisualState(page);
      await expect(page).toHaveScreenshot(
        `choose-plants-${viewport.name}.png`,
        {
          animations: 'disabled',
          caret: 'hide',
          maxDiffPixelRatio: visualMaxDiffPixelRatio(
            viewport.name === 'desktop' ? 0.05 : 0.01,
          ),
        },
      );
    });

    test(`optimize results ${viewport.name}`, async ({ page }) => {
      await setVisualViewport(page, viewport);
      await signInAndCreateBlankPlan(page);
      await addTomatoToSeasonList(page);
      await generateLayoutCandidates(page);
      await expect(
        page
          .getByRole('region', { name: 'Layout suggestion' })
          .getByRole('heading', {
            exact: true,
            name: 'Try a different arrangement',
          }),
      ).toBeVisible();
      await expect(
        page.getByRole('region', { name: 'Before and after preview' }),
      ).toBeVisible();
      await expect(page.getByLabel(/Layout diff overlay/)).toBeVisible();
      await stabilizeVisualState(page);
      await expect(page).toHaveScreenshot(
        `optimize-results-${viewport.name}.png`,
        {
          animations: 'disabled',
          caret: 'hide',
          maxDiffPixelRatio: visualMaxDiffPixelRatio(0.01),
        },
      );
    });

    test(`review queue ${viewport.name}`, async ({ page }) => {
      await setVisualViewport(page, viewport);
      await signInAndCreateBlankPlan(page);
      await addTomatoToPlan(page);
      await clickVisibleOrLauncherTool(page, 'Review problems');
      await expect(
        page.getByRole('heading', { name: 'Review problems' }),
      ).toBeVisible();
      await expect(
        page.getByRole('button', { name: 'Review problems' }),
      ).toBeVisible();
      await expect(
        page.getByRole('button', { name: 'Apply fix' }).first(),
      ).toBeVisible();
      await expect(
        page.getByRole('button', { name: 'Ignore for now' }).first(),
      ).toBeVisible();
      await stabilizeVisualState(page);
      await expect(page).toHaveScreenshot(`review-queue-${viewport.name}.png`, {
        animations: 'disabled',
        caret: 'hide',
        maxDiffPixelRatio: visualMaxDiffPixelRatio(0.01),
      });
    });

    if (viewport.name === 'desktop') {
      test(`plant editor ${viewport.name}`, async ({ page }) => {
        await setVisualViewport(page, viewport);
        await signInAndCreateBlankPlan(page);
        await addTomatoToPlan(page);
        const focus = page.getByRole('complementary', { name: 'Crop focus' });

        await expect(focus).toHaveCount(0);
        await openPlanTool(page, 'Details');
        await expect(
          page.getByRole('dialog', { name: /Edit Tomato/ }),
        ).toBeVisible();
        await expect(page.getByText('Picture metadata')).toHaveCount(0);
        await stabilizeVisualState(page);
        await expect(page).toHaveScreenshot(
          `plant-editor-${viewport.name}.png`,
          {
            animations: 'disabled',
            caret: 'hide',
            maxDiffPixelRatio: visualMaxDiffPixelRatio(0.01),
          },
        );
      });
    }
  }
});

async function setVisualViewport(
  page: Page,
  viewport: { height: number; width: number },
) {
  await page.setViewportSize({
    height: viewport.height,
    width: viewport.width,
  });
  await page.clock.setFixedTime(visualTime);
}

function visualMaxDiffPixelRatio(localRatio: number) {
  return process.env.CI
    ? Math.max(localRatio, ciMaxDiffPixelRatio)
    : localRatio;
}

async function signInAndLoadDemo(page: Page) {
  await signInAndCreateBlankPlan(page);
  await enterDemoFromShell(page);
}

async function signInAndCreateBlankPlan(page: Page) {
  await signInToFirstRunSetup(page);
  await page.getByLabel(/Blank plan/).check();
  await page.getByRole('button', { name: 'Create plan' }).click();
  await expect(page.locator('h1', { hasText: 'Plan' })).toBeVisible();
}

async function openChoosePlants(page: Page) {
  await clickVisibleOrLauncherTool(page, 'Add plants');
  await expect(
    page.getByRole('dialog', { name: 'Choose Plants' }),
  ).toBeVisible();
}

async function addTomatoToSeasonList(page: Page) {
  await openChoosePlants(page);
  await page.getByRole('searchbox', { name: 'Search plants' }).fill('tomato');
  await page.getByRole('button', { name: 'Add Tomato' }).click();
  const expandPickedPlants = page.getByRole('button', {
    name: 'Expand picked plants',
  });
  const seasonBoardTab = page.getByRole('tab', { name: 'Picked' });

  if (await expandPickedPlants.isVisible().catch(() => false)) {
    await expandPickedPlants.click();
  }

  if (await seasonBoardTab.isVisible().catch(() => false)) {
    await seasonBoardTab.click();
  }

  await expect(
    page.getByRole('region', { name: 'Season crop board' }),
  ).toContainText('Tomato');
  await page.getByRole('button', { name: 'Save list' }).click();
  await expect(page.getByRole('dialog', { name: 'Choose Plants' })).toHaveCount(
    0,
  );
}

async function addTomatoToPlan(page: Page) {
  await openPlanTool(page, 'Plant');
  await page.getByRole('button', { name: 'Open plant picker' }).click();
  await page.getByRole('searchbox', { name: 'Search crops' }).fill('tomato');
  await page.getByRole('button', { exact: true, name: 'Tomato crop' }).click();
  await page.getByRole('button', { exact: true, name: 'Add plant' }).click();
  await expect(
    page.getByRole('button', { name: 'Tomato at X: 6.0 ft, Y: 4.0 ft' }),
  ).toBeVisible();
}

async function generateLayoutCandidates(page: Page) {
  await clickVisibleOrLauncherTool(page, 'Generate layout');

  await expect(
    page.getByRole('heading', { name: 'Review problems' }),
  ).toBeVisible();
  const beforeAfterPreview = page.getByRole('region', {
    name: 'Before and after preview',
  });

  if (!(await beforeAfterPreview.isVisible().catch(() => false))) {
    await page
      .getByRole('button', { name: /Generate layout|Check again/ })
      .first()
      .click();
  }
}

async function clickVisibleOrLauncherTool(page: Page, name: string) {
  const visibleButton = page.getByRole('button', { name }).first();

  if (await visibleButton.isVisible().catch(() => false)) {
    await visibleButton.click();
    return;
  }

  await page.getByRole('button', { name: 'Open more tools' }).click();
  const launcher = page.locator('[aria-label="More tools menu"]');

  await expect(launcher).toBeVisible();
  await launcher.getByRole('button', { name }).click({ force: true });
}

async function stabilizeVisualState(page: Page) {
  await page.waitForLoadState('networkidle');
  await page.evaluate(`
    (() => {
      window.scrollTo(0, 0);
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
      document.querySelectorAll('*').forEach((element) => {
        if ('scrollTop' in element && typeof element.scrollTop === 'number' && element.scrollTop !== 0) {
          element.scrollTop = 0;
        }
        if ('scrollLeft' in element && typeof element.scrollLeft === 'number' && element.scrollLeft !== 0) {
          element.scrollLeft = 0;
        }
      });
    })()
  `);
  await page.waitForTimeout(100);
}

async function resetChoosePlantsScrollState(page: Page) {
  await page.evaluate(() => {
    const dialog = (globalThis as { document?: unknown }).document as
      | {
          querySelector(selector: string): unknown;
        }
      | undefined;
    const root = dialog?.querySelector('[role="dialog"]') as
      | {
          querySelectorAll(selector: string): ArrayLike<{
            scrollTop?: number;
          }>;
        }
      | undefined;

    if (!root) {
      return;
    }

    Array.from(root.querySelectorAll('*')).forEach((element) => {
      if (typeof element.scrollTop === 'number' && element.scrollTop !== 0) {
        element.scrollTop = 0;
      }
    });
  });
}
