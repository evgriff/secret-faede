import { expect, test, type Page } from '@playwright/test';

import {
  addCropGroup,
  createGarden,
  expectFocused,
  publishDraft,
  readWorkspace,
  saveDraft,
  seedTodayTask,
} from './appSmokeHelpers';

test.describe('crop-specific watering and Today operations', () => {
  test('keeps recommendations separate, fails safe, deep-links, and records zero-credit skips', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await createGarden(page, { name: 'Operations garden' });
    await addCropGroup(page, 'Tomato', {
      growingArea: 'Raised bed',
      lifecycle: 'Growing',
    });
    await addCropGroup(page, 'Lettuce', {
      growingArea: 'Raised bed',
      lifecycle: 'Growing',
    });
    await page.getByLabel('Center Y in feet').fill('4');
    await expect(
      page.getByRole('button', { name: 'Review 0 active plan issues' }),
    ).toBeVisible();
    await saveDraft(page);
    await publishDraft(page, 'Publish separate crop watering targets');

    let state = await readWorkspace(page);
    const publishedPlan = state.published.plan;
    const tomato = publishedPlan.plantings.find(
      (planting) => planting.cropName === 'Tomato',
    );
    const lettuce = publishedPlan.plantings.find(
      (planting) => planting.cropName === 'Lettuce',
    );
    if (!tomato || !lettuce) throw new Error('Both crop groups must be saved.');
    const taskId = await seedTodayTask(page, {
      cropGroupId: tomato.id,
      cropName: tomato.cropName,
    });

    await page.goto(
      `/app/today?focus=watering&cropGroupId=${encodeURIComponent(tomato.id)}`,
    );
    await expect(
      page.getByRole('heading', { exact: true, level: 1, name: 'Today' }),
    ).toBeVisible();

    const tomatoCard = cropCard(page, 'Tomato');
    const lettuceCard = cropCard(page, 'Lettuce');
    await expect(tomatoCard).toBeVisible();
    await expect(lettuceCard).toBeVisible();
    await expect(tomatoCard).toContainText('Check soil');
    await expect(lettuceCard).toContainText('Check soil');
    await expect(tomatoCard).toContainText('Insufficient weather data');
    await expect(lettuceCard).toContainText('Insufficient weather data');
    await expect(
      tomatoCard.getByText('Recommendation', { exact: true }),
    ).toHaveCount(0);
    await expect(
      lettuceCard.getByText('Recommendation', { exact: true }),
    ).toHaveCount(0);
    await expectFocused(tomatoCard);

    await page.goto(
      `/app/today?focus=task&taskId=${encodeURIComponent(taskId)}`,
    );
    const taskCard = page.locator('article').filter({ hasText: 'Tie tomato' });
    await expect(taskCard).toBeVisible();
    await expectFocused(taskCard);
    await taskCard.getByRole('button', { name: 'Complete' }).click();
    await expect(taskCard).toContainText('Done');
    await expect(
      taskCard.getByRole('button', { name: 'Reopen' }),
    ).toBeVisible();
    await taskCard.getByRole('button', { name: 'Reopen' }).click();
    await expect(
      taskCard.getByRole('button', { name: 'Complete' }),
    ).toBeVisible();
    await taskCard.getByRole('button', { name: 'Snooze 1 day' }).click();
    await expect(page.getByText('Task snoozed until tomorrow.')).toBeVisible();

    await tomatoCard
      .getByRole('button', { name: 'Log watering decision' })
      .click();
    const log = page.getByRole('dialog', { name: 'Log watering' });
    await log.getByRole('radio', { name: /^Skipped/ }).check();
    await log.getByLabel('Why was it skipped?').fill('Soil is still moist');
    await log.getByRole('button', { name: 'Save decision' }).click();
    await expect(log).toHaveCount(0);
    await expect(
      page.getByText('Skipped watering recorded with zero water credit.'),
    ).toBeVisible();

    state = await readWorkspace(page);
    const application = state.waterApplications.find(
      (item) => item.cropGroupId === tomato.id,
    );
    expect(application).toMatchObject({
      cropGroupId: tomato.id,
      outcome: 'skipped',
      skipReason: 'Soil is still moist',
    });
    expect(application).not.toHaveProperty('amount');
    expect(application).not.toHaveProperty('efficiency');
    expect(state.tasks.find((item) => item.id === taskId)).toMatchObject({
      status: 'snoozed',
    });
    expect(
      state.waterApplications.some((item) => item.cropGroupId === lettuce.id),
    ).toBe(false);
  });
});

function cropCard(page: Page, cropName: string) {
  return page.getByRole('article', {
    name: `${cropName} in Raised bed`,
  });
}
