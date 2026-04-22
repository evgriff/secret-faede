import { expect, test, type Page } from '@playwright/test';

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
        maxDiffPixelRatio: 0.01,
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
            maxDiffPixelRatio: 0.01,
          },
        );
      });
    }
  }
});

test.describe('Plan workflow visual baselines', () => {
  for (const viewport of viewports) {
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
        await page.getByRole('tab', { name: 'Season Board' }).click();
      }
      await expect(
        page.getByRole('region', { name: 'Season crop board' }),
      ).toContainText('Tomato');
      await stabilizeVisualState(page);
      await expect(page).toHaveScreenshot(
        `choose-plants-${viewport.name}.png`,
        {
          animations: 'disabled',
          caret: 'hide',
          maxDiffPixelRatio: 0.01,
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
          .getByRole('region', { name: 'Layout walkthrough' })
          .getByText('Proposal walkthrough'),
      ).toBeVisible();
      await expect(
        page.getByRole('region', { name: 'Before and after preview' }),
      ).toBeVisible();
      await expect(page.getByLabel(/Proposal diff overlay/)).toBeVisible();
      await stabilizeVisualState(page);
      await expect(page).toHaveScreenshot(
        `optimize-results-${viewport.name}.png`,
        {
          animations: 'disabled',
          caret: 'hide',
          maxDiffPixelRatio: 0.01,
        },
      );
    });

    test(`review queue ${viewport.name}`, async ({ page }) => {
      await setVisualViewport(page, viewport);
      await signInAndCreateBlankPlan(page);
      await addTomatoToSeasonList(page);
      await generateLayoutCandidates(page);
      await expect(
        page.getByRole('button', { exact: true, name: 'Accept' }).first(),
      ).toBeVisible();
      await page
        .getByRole('button', { exact: true, name: 'Accept' })
        .first()
        .click();
      await expect(page.getByText('Accepted into this draft.')).toHaveCount(1);
      await stabilizeVisualState(page);
      await expect(page).toHaveScreenshot(`review-queue-${viewport.name}.png`, {
        animations: 'disabled',
        caret: 'hide',
        maxDiffPixelRatio: 0.01,
      });
    });
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

async function signInAndLoadDemo(page: Page) {
  await signInAndCreateBlankPlan(page);
  await page.getByRole('button', { name: 'Enter demo' }).click();
  await expect(
    page.getByLabel('Demo controls').getByRole('button', { name: 'Exit demo' }),
  ).toBeVisible();
  await expect(page.getByText('20 ft by 16 ft')).toBeVisible({
    timeout: 15_000,
  });
}

async function signInAndCreateBlankPlan(page: Page) {
  await page.goto('/');
  await page.getByLabel('Email').fill('primary.gardener@example.com');
  await page.getByLabel('Password', { exact: true }).fill('password');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(
    page.getByRole('heading', { name: 'Set up your garden' }),
  ).toBeVisible();
  await page.getByLabel(/Blank plan/).check();
  await page.getByRole('button', { name: 'Create plan' }).click();
  await expect(page.locator('h1', { hasText: 'Plan' })).toBeVisible();
}

async function openChoosePlants(page: Page) {
  await clickVisibleOrLauncherTool(page, 'Choose plants');
  await expect(
    page.getByRole('dialog', { name: 'Choose Plants' }),
  ).toBeVisible();
}

async function addTomatoToSeasonList(page: Page) {
  await openChoosePlants(page);
  await page.getByRole('searchbox', { name: 'Search plants' }).fill('tomato');
  await page.getByRole('button', { name: 'Add Tomato' }).click();
  const seasonBoardTab = page.getByRole('tab', { name: 'Season Board' });

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

async function generateLayoutCandidates(page: Page) {
  await clickVisibleOrLauncherTool(page, 'Optimize');

  await expect(
    page.getByRole('heading', { name: 'Review proposals' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Generate layouts' }).first().click();
}

async function clickVisibleOrLauncherTool(page: Page, name: string) {
  const visibleButton = page.getByRole('button', { name }).first();

  if (await visibleButton.isVisible().catch(() => false)) {
    await visibleButton.click();
    return;
  }

  await page.getByRole('button', { name: 'Open Plan tools' }).click();
  const launcher = page.getByLabel('Plan tool launcher');

  await expect(launcher).toBeVisible();
  await launcher.getByRole('button', { name }).click();
}

async function stabilizeVisualState(page: Page) {
  await page.waitForLoadState('networkidle');
  await page.evaluate('window.scrollTo(0, 0)');
  await page.waitForTimeout(100);
}
