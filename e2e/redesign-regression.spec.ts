import { expect, test, type Locator, type Page } from '@playwright/test';

import {
  addTomatoToSeasonList,
  enterDemoFromShell,
  expandPickedPlants,
  openPlanTool,
  signInToFirstRunSetup,
  signInWithMockPassword,
} from './appSmokeHelpers';

test('first-run setup keeps final controls reachable at standard desktop zoom', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1365, height: 620 });
  await signInToFirstRunSetup(page);

  const routeContent = page.locator('main');
  const starterLayout = routeContent.locator('[aria-label="Starter layout"]');
  const pollinatorCard = starterLayout.locator('label').last();
  const pollinatorTemplate = pollinatorCard.locator('input[type="radio"]');
  const createPlan = page.getByRole('button', { name: 'Create plan' });
  await scrollSetupIfNeeded(routeContent);
  await expect(pollinatorCard).toContainText('Pollinator/herb bed');

  await pollinatorTemplate.focus();
  await expect(pollinatorTemplate).toBeFocused();
  await expect(createPlan).toBeInViewport();
  await page.keyboard.press('Tab');
  await expect(createPlan).toBeFocused();
  await createPlan.press('Enter');
  await expect(
    page.getByRole('heading', { exact: true, name: 'Plan' }),
  ).toBeVisible();
});

test('first-run setup can scroll to the lower starter layouts on tighter heights', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1365, height: 520 });
  await signInToFirstRunSetup(page);

  const routeContent = page.locator('main');
  const pollinatorTemplate = routeContent
    .locator('[aria-label="Starter layout"] input[type="radio"]')
    .last();
  const pollinatorCard = routeContent
    .locator('[aria-label="Starter layout"] label')
    .last();
  const createPlan = page.getByRole('button', { name: 'Create plan' });

  await scrollSetupIfNeeded(routeContent);
  await expect(pollinatorCard).toContainText('Pollinator/herb bed');
  await pollinatorTemplate.focus();
  await expect(pollinatorTemplate).toBeFocused();
  await expect(createPlan).toBeInViewport();
});

test('quantity-first Add Plant creates one grouped footprint without resizing the plot', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1365, height: 768 });
  await signInWithMockPassword(page);

  const viewport = page.getByTestId('plot-viewport');
  const stableSize = await readViewportSize(page);

  await openPlanTool(page, 'Plant');
  await expect(viewport).toHaveJSProperty('clientWidth', stableSize.width);
  await expect(viewport).toHaveJSProperty('clientHeight', stableSize.height);

  await page.getByRole('button', { name: 'Open plant picker' }).click();
  const addPlant = page.getByRole('dialog', { name: 'Add Plant' });

  await expect(addPlant).toBeVisible();
  await expect(addPlant.getByLabel('How many plants?')).toHaveValue('1');
  await expect(addPlant.getByText(/Recommended:/)).toBeVisible();
  await expect(addPlant.getByLabel('Need')).toHaveCount(0);
  await expect(addPlant.getByLabel('Priority')).toHaveCount(0);
  await expect(addPlant.getByText('Fit confidence')).toHaveCount(0);

  await addPlant
    .getByRole('searchbox', { name: 'Search crops' })
    .fill('tomato');
  await addPlant
    .getByRole('button', { exact: true, name: 'Tomato crop' })
    .click();
  await addPlant.getByLabel('How many plants?').fill('3');
  await expect(
    addPlant.getByText(/Will place 3 plants as one group\./),
  ).toBeVisible();
  await addPlant.getByRole('button', { name: 'Add plant' }).click();

  await expect(
    page.getByRole('button', { name: /Tomato group, 3 plants at X:/ }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: /Tomato 1 at X:/ }),
  ).toHaveCount(0);
  await expect(page.getByLabel('Edit Tomato group')).toBeVisible();
  await expect(viewport).toHaveJSProperty('clientWidth', stableSize.width);
  await expect(
    page.getByRole('complementary', { name: 'Crop focus' }),
  ).toBeVisible();

  const focusedSize = await readViewportSize(page);

  expect(focusedSize.height).toBeGreaterThanOrEqual(500);
});

test('plant picking modals keep their footer actions visible on short viewports', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1365, height: 620 });
  await signInWithMockPassword(page);

  await page
    .getByRole('button', { name: /add plants/i })
    .first()
    .click();
  const choosePlants = page.getByRole('dialog', { name: 'Choose Plants' });

  await expect(choosePlants).toBeVisible();
  await expect(
    choosePlants.getByRole('button', { name: 'Close choose plants' }),
  ).toBeInViewport();
  await expect(
    choosePlants.getByRole('button', { name: 'Save list' }),
  ).toBeInViewport();
  await expect(
    choosePlants.getByRole('button', { name: 'Save and improve plan' }),
  ).toBeInViewport();
  await expandPickedPlants(page);
  await expect(
    choosePlants.getByRole('combobox', { name: 'Crops already on the plot' }),
  ).toBeInViewport();
  const locationReason = choosePlants
    .getByRole('button', { name: /plot fit reason/i })
    .first();

  await locationReason.focus();
  await expect(choosePlants.getByRole('tooltip').first()).toBeVisible();
  await expect(choosePlants.getByRole('tooltip').first()).not.toHaveText('');
  await choosePlants
    .getByRole('button', { name: 'Close choose plants' })
    .click();
  await expect(choosePlants).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Plan' })).toBeVisible();

  await openPlanTool(page, 'Plant');
  const planContextPanel = page.getByLabel('Plan context panel');

  await expect(planContextPanel).toBeVisible({ timeout: 15_000 });
  await planContextPanel
    .getByRole('button', { name: 'Open plant picker' })
    .click({ force: true });
  const addPlant = page.getByRole('dialog', { name: 'Add Plant' });

  await expect(addPlant).toBeVisible();
  await expect(
    addPlant.getByRole('button', { name: 'Cancel' }),
  ).toBeInViewport();
  await expect(
    addPlant.getByRole('button', { name: 'Add plant' }),
  ).toBeInViewport();
});

test('Choose Plants keeps long watermelon cards from colliding', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1365, height: 768 });
  await signInWithMockPassword(page);

  await page
    .getByRole('button', { name: /add plants/i })
    .first()
    .click();
  const choosePlants = page.getByRole('dialog', { name: 'Choose Plants' });

  await expect(choosePlants).toBeVisible();
  await choosePlants
    .getByRole('searchbox', { name: 'Search plants' })
    .fill('watermelon');
  await expect(
    choosePlants.getByRole('button', { name: 'Add Dwarf Watermelon' }),
  ).toBeVisible();
  await choosePlants
    .getByRole('button', { name: 'Add Dwarf Watermelon' })
    .click();
  await expect(
    choosePlants.getByRole('button', { name: 'Expand picked plants' }),
  ).toBeVisible();
  await expect(
    choosePlants.getByRole('button', { name: 'Compare Dwarf Watermelon' }),
  ).toBeInViewport();

  await expandPickedPlants(page);
  await expect(
    choosePlants.getByRole('region', { name: 'Season crop board' }),
  ).toContainText('Dwarf Watermelon');
  await expect(
    choosePlants.getByRole('button', { name: 'Collapse picked side' }),
  ).toBeInViewport();
});

test('save and improve plan shows truthful layout-generation stages', async ({
  page,
}) => {
  await page.addInitScript((delayMs) => {
    const browserGlobal = globalThis as typeof globalThis & {
      localStorage: Storage;
      __secretFaeriesAutoLayoutStageDelayMs?: number;
    };

    Object.assign(browserGlobal, {
      __secretFaeriesAutoLayoutStageDelayMs: delayMs,
    });
    browserGlobal.localStorage.setItem(
      'secret-faeries:auto-layout-stage-delay-ms',
      String(delayMs),
    );
  }, 700);
  await page.setViewportSize({ width: 1365, height: 768 });
  await signInWithMockPassword(page);

  await page
    .getByRole('button', { name: /add plants/i })
    .first()
    .click();
  const choosePlants = page.getByRole('dialog', { name: 'Choose Plants' });

  await expect(choosePlants).toBeVisible();
  await choosePlants
    .getByRole('searchbox', { name: 'Search plants' })
    .fill('tomato');
  await choosePlants.getByRole('button', { name: 'Add Tomato' }).click();
  await choosePlants
    .getByRole('button', { name: 'Save and improve plan' })
    .click();

  const workflow = page.getByRole('region', {
    name: 'Layout suggestion workflow',
  });

  await expect(choosePlants).toHaveCount(0);
  await expectBusyStage(page, workflow, {
    message: 'Collecting the current spacing, access, and support constraints.',
    stageLabel: 'Collecting constraints',
  });
  await expectBusyStage(page, workflow, {
    message: 'Generating one checked whole-plot suggestion.',
    stageLabel: 'Generating suggestion',
  });
  await expectBusyStage(page, workflow, {
    message: 'Validating the suggestion against the current must-fix issues.',
    stageLabel: 'Validating suggestion',
  });
  await expectBusyStage(page, workflow, {
    message: 'Preparing the before-and-after preview for review.',
    stageLabel: 'Preparing preview',
  });

  const walkthrough = page.getByRole('region', { name: 'Layout suggestion' });

  await expect(
    page.getByText('One checked layout suggestion is ready to review.'),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Check again' })).toBeVisible();
  await expect(walkthrough.first()).toBeVisible();
});

async function expectBusyStage(
  page: Page,
  workflow: Locator,
  {
    message,
    stageLabel,
  }: {
    message: string;
    stageLabel: string;
  },
) {
  await expect(page.getByText(message)).toBeVisible();
  await expect(workflow.getByRole('button')).toBeDisabled();
  await expect(
    workflow.locator('li[data-state="active"]').filter({ hasText: stageLabel }),
  ).toBeVisible();
}

async function scrollSetupIfNeeded(routeContent: Locator) {
  const routeMetrics = await routeContent.evaluate((element) => ({
    clientHeight: element.clientHeight,
    scrollHeight: element.scrollHeight,
  }));

  if (routeMetrics.scrollHeight <= routeMetrics.clientHeight) {
    return;
  }

  await routeContent.evaluate((element) => {
    element.scrollTo({ top: element.scrollHeight });
  });
}

for (const viewport of [
  { height: 768, name: 'desktop', width: 1365 },
  { height: 780, name: 'mobile', width: 390 },
] as const) {
  test(`Add Plant keeps filters clear of results on ${viewport.name}`, async ({
    page,
  }) => {
    await page.setViewportSize({
      height: viewport.height,
      width: viewport.width,
    });
    await signInWithMockPassword(page);
    await openPlanTool(page, 'Plant');
    await page.getByRole('button', { name: 'Open plant picker' }).click();

    const addPlant = page.getByRole('dialog', { name: 'Add Plant' });
    const cropType = addPlant.getByRole('combobox', { name: /Crop type/i });
    const advancedFilters = addPlant.getByRole('button', {
      name: 'Advanced filters',
    });
    const cropButtons = addPlant.locator('button[aria-label$=" crop"]');
    const filtersPanel = addPlant.getByTestId('add-plant-filters-panel');
    const resultsPanel = addPlant.getByTestId('add-plant-results-panel');
    const firstResult = cropButtons.first();
    const secondResult = cropButtons.nth(1);

    await expect(addPlant).toBeVisible();
    await expect(cropType).toBeVisible();
    await expect(firstResult).toBeVisible();
    await expect(secondResult).toBeVisible();
    await expect(
      addPlant.getByRole('button', { name: 'Cancel' }),
    ).toBeInViewport();
    await expect(
      addPlant.getByRole('button', { name: 'Add plant' }),
    ).toBeInViewport();

    const [filtersPanelBox, firstResultBox, secondResultBox] =
      await Promise.all([
        filtersPanel.boundingBox(),
        firstResult.boundingBox(),
        secondResult.boundingBox(),
      ]);
    const firstResultHeight: number = await firstResult.evaluate(
      (element) => element.getBoundingClientRect().height,
    );
    const secondResultHeight: number = await secondResult.evaluate(
      (element) => element.getBoundingClientRect().height,
    );

    expect(filtersPanelBox).not.toBeNull();
    expect(firstResultBox).not.toBeNull();
    expect(secondResultBox).not.toBeNull();

    const filterBottom =
      (filtersPanelBox?.y ?? 0) + (filtersPanelBox?.height ?? 0);

    expect(firstResultBox?.y ?? 0).toBeGreaterThan(filterBottom + 8);
    expect(
      Math.abs(firstResultHeight - secondResultHeight),
    ).toBeLessThanOrEqual(1);

    await advancedFilters.click();
    await expect(
      addPlant.getByRole('combobox', { name: /Growth form/i }),
    ).toBeVisible();
    await expect(
      addPlant.getByRole('combobox', { name: /Sow method/i }),
    ).toBeVisible();
    await expect(firstResult).toBeVisible();
    await expect(secondResult).toBeVisible();

    const [resultsPanelBox, firstExpandedBox, secondExpandedBox] =
      await Promise.all([
        resultsPanel.boundingBox(),
        firstResult.boundingBox(),
        secondResult.boundingBox(),
      ]);

    expect(resultsPanelBox).not.toBeNull();
    expect(firstExpandedBox).not.toBeNull();
    expect(secondExpandedBox).not.toBeNull();
    expect(secondExpandedBox?.y ?? 0).toBeGreaterThanOrEqual(
      firstExpandedBox?.y ?? 0,
    );
    expect(
      (secondExpandedBox?.y ?? 0) + (secondExpandedBox?.height ?? 0),
    ).toBeLessThanOrEqual(
      (resultsPanelBox?.y ?? 0) + (resultsPanelBox?.height ?? 0) - 2,
    );
  });
}

test('Add Plant keyboard flow reaches advanced filters, results, and footer', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1365, height: 768 });
  await signInWithMockPassword(page);
  await openPlanTool(page, 'Plant');
  await page.getByRole('button', { name: 'Open plant picker' }).click();

  const addPlant = page.getByRole('dialog', { name: 'Add Plant' });
  const search = addPlant.getByRole('searchbox', { name: 'Search crops' });
  const location = addPlant.getByRole('combobox', {
    name: /Fits my location/i,
  });
  const timing = addPlant.getByRole('combobox', { name: /Planting time/i });
  const sun = addPlant.getByRole('combobox', { name: /^Sun$/i });
  const water = addPlant.getByRole('combobox', { name: /^Water$/i });
  const cropType = addPlant.getByRole('combobox', { name: /Crop type/i });
  const advancedFilters = addPlant.getByRole('button', {
    name: 'Advanced filters',
  });
  const growthForm = addPlant.getByRole('combobox', { name: /Growth form/i });
  const sowMethod = addPlant.getByRole('combobox', { name: /Sow method/i });
  const firstResult = addPlant.getByRole('button', {
    exact: true,
    name: 'Tomato crop',
  });
  const cancel = addPlant.getByRole('button', { name: 'Cancel' });
  const submit = addPlant.getByRole('button', { name: 'Add plant' });

  await search.focus();
  await expect(search).toBeFocused();
  await search.fill('tomato');
  await expect(firstResult).toBeVisible();
  await page.keyboard.press('Tab');
  await expect(location).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(timing).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(sun).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(water).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(cropType).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(advancedFilters).toBeFocused();

  await page.keyboard.press('Enter');
  await expect(growthForm).toBeVisible();
  await page.keyboard.press('Tab');
  await expect(growthForm).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(sowMethod).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(firstResult).toBeFocused();

  let focusedFooter: 'cancel' | 'submit' | null = null;

  for (let index = 0; index < 120; index += 1) {
    if (
      await cancel.evaluate(
        (element) => element === (element.ownerDocument?.activeElement ?? null),
      )
    ) {
      focusedFooter = 'cancel';
      break;
    }

    if (
      await submit.evaluate(
        (element) => element === (element.ownerDocument?.activeElement ?? null),
      )
    ) {
      focusedFooter = 'submit';
      break;
    }

    await page.keyboard.press('Tab');
  }

  expect(focusedFooter).not.toBeNull();

  if (focusedFooter === 'submit') {
    await page.keyboard.press('Shift+Tab');
  }

  await expect(cancel).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(submit).toBeFocused();
});

test('generate layout opens a visual walkthrough without certainty copy', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1365, height: 768 });
  await signInWithMockPassword(page);
  await addTomatoToSeasonList(page);

  await openPlanTool(page, 'Generate layout');
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

  const walkthrough = page.getByRole('region', {
    name: 'Layout suggestion',
  });
  const suggestionHeading = page.getByRole('heading', {
    exact: true,
    name: 'Try a different arrangement',
  });

  await expect(walkthrough.first()).toBeVisible();
  await expect(suggestionHeading).toHaveCount(1);
  await expect(suggestionHeading).toBeVisible();
  await expect(beforeAfterPreview).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Apply this layout' }),
  ).toHaveCount(1);
  await expect(
    page.getByRole('button', { name: 'Keep current layout' }),
  ).toHaveCount(1);
  await expect(page.getByLabel(/Layout diff overlay/)).toBeVisible();
  await expect(page.locator('body')).not.toContainText('Fit confidence');
  await expect(page.locator('body')).not.toContainText(/checked variants/i);
  await expect(page.locator('body')).not.toContainText(/selected variant/i);
});

test('Feed compose launcher exposes explicit private memory actions only', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 780 });
  await signInWithMockPassword(page);
  await page.goto('/app/feed');

  await expect(page.getByRole('button', { name: 'New entry' })).toBeVisible();
  await expect(
    page.getByRole('button', { exact: true, name: 'Post' }),
  ).toHaveCount(0);
  await expect(
    page.getByRole('button', { exact: true, name: 'Photo' }),
  ).toHaveCount(0);
  await expect(page.locator('body')).not.toContainText(/carrier messaging|notification provider/);

  await page.getByRole('button', { name: 'New entry' }).click();
  const composer = page.getByRole('dialog', { name: 'New feed entry' });

  await expect(composer).toBeVisible();
  await expect(
    composer.getByRole('button', { exact: true, name: 'New note' }),
  ).toBeVisible();
  await expect(
    composer.getByRole('button', { exact: true, name: 'New issue' }),
  ).toBeVisible();
  await expect(
    composer.getByRole('button', {
      exact: true,
      name: 'New photo update',
    }),
  ).toBeVisible();
  await expect(
    composer.getByRole('button', { exact: true, name: 'Log harvest' }),
  ).toBeVisible();

  await composer
    .getByRole('button', { exact: true, name: 'New photo update' })
    .click();
  await expect(
    composer.getByRole('button', { name: 'Save photo update' }),
  ).toBeVisible();
});

test('reduced motion keeps Today sheet and Feed composer settled', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 390, height: 780 });
  await signInWithMockPassword(page);
  await enterDemoFromShell(page);

  await page.goto('/app/today');
  await page
    .getByRole('heading', { name: 'Field follow-up' })
    .scrollIntoViewIfNeeded();
  await page.getByText('Field entry').click();
  await page.getByRole('button', { name: 'Report issue' }).click();
  const todaySheet = page.getByRole('dialog', { name: 'Report issue' });

  await expect(todaySheet).toBeVisible();
  await expect(todaySheet.locator('[data-action-kind="issue"]')).toBeVisible();
  await expect(todaySheet).toHaveCSS('transform', 'none');
  await todaySheet.getByRole('button', { name: /Close/ }).click();
  await expect(todaySheet).toHaveCount(0);

  await page.goto('/app/feed');
  await page.getByRole('button', { name: 'New entry' }).click();
  const composer = page.getByRole('dialog', { name: 'New feed entry' });

  await expect(composer).toBeVisible();
  await expect(composer).toHaveCSS('transform', 'none');
  await composer
    .getByRole('button', { exact: true, name: 'New photo update' })
    .click();
  await expect(composer.locator('[data-composer-mode="photo"]')).toBeVisible();
});

test('sample garden tools stay in Settings and do not surface removed scope', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1365, height: 768 });
  await signInWithMockPassword(page);

  await expect(page.getByTestId('sample-garden-shell-restore')).toHaveCount(0);

  await page.getByRole('link', { name: 'Settings' }).click();
  await expect(page.getByTestId('sample-garden-disclosure')).toBeVisible();
  await page.getByTestId('sample-garden-disclosure').locator('summary').click();
  const demoControls = page.getByRole('region', { name: 'Sample garden' });
  await demoControls
    .getByRole('button', { name: 'Open sample garden' })
    .click();
  await expect(demoControls).toContainText('Sample garden active.');

  await expect(
    demoControls.getByRole('button', { name: 'Reset sample garden' }),
  ).toBeVisible();
  await expect(
    demoControls.getByRole('button', { name: 'Back to my garden' }),
  ).toBeVisible();
  const shellRestore = page.getByTestId('sample-garden-shell-restore');
  await expect(shellRestore).toBeVisible();
  await page.getByRole('link', { exact: true, name: 'Today' }).click();
  await expect(
    page.getByRole('heading', { exact: true, name: 'Today' }),
  ).toBeVisible();
  await expect(shellRestore).toBeVisible();
  await shellRestore.click();
  await expect(page).toHaveURL(/\/app\/today$/);
  await expect(shellRestore).toHaveCount(0);
  await expect(page.locator('body')).not.toContainText(
    /Fit confidence|carrier messaging|notification provider/,
  );
});

async function readViewportSize(page: Page) {
  return page.getByTestId('plot-viewport').evaluate((viewport) => ({
    height: viewport.clientHeight,
    width: viewport.clientWidth,
  }));
}
