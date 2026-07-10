import { expect, test } from '@playwright/test';

import {
  addCropGroup,
  createGarden,
  readWorkspace,
  saveDraft,
} from './appSmokeHelpers';

test.describe('measured Plan workflow', () => {
  test('sets up, adds, edits, drags, saves, reviews, publishes, and restores', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1365, height: 900 });
    await createGarden(page, {
      depthFt: 14,
      name: 'North kitchen garden',
      template: 'Raised bed',
      widthFt: 20,
    });
    await expect(
      page.getByRole('group', { name: '20 by 14 foot garden plot' }),
    ).toBeVisible();

    await page.getByRole('button', { name: 'Add crop' }).click();
    const emptyDialog = page.getByRole('dialog', { name: 'Add a crop group' });
    await emptyDialog.getByRole('button', { name: 'Add crop group' }).click();
    await expect(
      emptyDialog
        .getByRole('alert')
        .getByText('Choose a crop before adding it'),
    ).toBeVisible();
    await emptyDialog.getByRole('button', { name: 'Cancel' }).click();

    const tomato = await addCropGroup(page, 'Tomato', {
      growingArea: 'Raised bed',
      lifecycle: 'Growing',
      quantity: 1,
    });
    await expect(page.getByText('Specific to this Tomato group')).toBeVisible();
    await page.getByLabel('Center X in feet').fill('9.5');
    await page.getByLabel('Center Y in feet').fill('6');
    await page.getByLabel('Weekly need (inches)').fill('1.35');
    await page.getByLabel('Root depth (inches)').fill('20');
    await expect(tomato).toHaveAccessibleName(/X 9\.50 feet, Y 6\.00 feet/);

    const beforeDrag = await page.getByLabel('Center X in feet').inputValue();
    const box = await tomato.boundingBox();
    if (!box) throw new Error('Tomato crop group has no drag bounds.');
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(
      box.x + box.width / 2 + 34,
      box.y + box.height / 2 + 12,
    );
    await page.mouse.up();
    await expect(page.getByLabel('Center X in feet')).not.toHaveValue(
      beforeDrag,
    );

    await addCropGroup(page, 'Lettuce', {
      growingArea: 'Raised bed',
      lifecycle: 'Growing',
    });

    await saveDraft(page);
    let state = await readWorkspace(page);
    const draft = Object.values(state.drafts)[0];
    expect(draft?.plan.name).toBe('North kitchen garden');
    expect(draft?.plan.plantings[0]?.lifecycle).toBe('growing');
    expect(draft?.plan.plantings[0]?.xFt).not.toBe(9.5);

    await page
      .getByRole('button', { name: /Review 1 active plan issue/ })
      .click();
    const review = page.getByRole('dialog', { name: 'Review plan problems' });
    await expect(review.getByText('Crop groups overlap')).toBeVisible();
    await expect(
      review.getByText(
        'This physical conflict must be resolved before publishing.',
      ),
    ).toBeVisible();
    await expect(
      review.getByRole('button', { name: 'Ignore for now' }),
    ).toHaveCount(0);
    await review
      .getByRole('button', { name: 'Close Review plan problems' })
      .click();

    await page.getByLabel('Center Y in feet').fill('4');
    await expect(
      page.getByRole('button', { name: 'Review 0 active plan issues' }),
    ).toBeVisible();

    await page.getByLabel('Growing area').selectOption({ label: 'Unassigned' });
    await page
      .getByRole('button', { name: 'Review 1 active plan issue' })
      .click();
    await expect(
      review.getByText('Growing area is not assigned'),
    ).toBeVisible();
    await review.getByRole('button', { name: 'Ignore for now' }).click();
    await expect(review.getByText('No active plan problems.')).toBeVisible();
    await review.getByRole('button', { name: 'Restore issue' }).click();
    await expect(review.getByText('1 active issue.')).toBeVisible();
    await review
      .getByRole('button', { name: 'Close Review plan problems' })
      .click();

    await page.getByLabel('Growing area').selectOption({ label: 'Raised bed' });
    await expect(
      page.getByRole('button', { name: 'Review 0 active plan issues' }),
    ).toBeVisible();
    await saveDraft(page);

    await page.getByRole('button', { name: 'Publish' }).click();
    const publish = page.getByRole('dialog', {
      name: 'Publish this private draft?',
    });
    await publish.getByLabel('Change summary').fill('Measured tomato baseline');
    await publish.getByRole('button', { name: 'Publish shared plan' }).click();
    await expect(publish).toHaveCount(0);

    state = await readWorkspace(page);
    expect(state.published.plan.name).toBe('North kitchen garden');
    expect(state.revisions[0]?.changeSummary).toBe('Measured tomato baseline');
    expect(Object.keys(state.drafts)).toHaveLength(0);

    await page.getByRole('button', { name: 'History' }).click();
    const history = page.getByRole('dialog', {
      name: 'Published plan history',
    });
    const initial = history
      .locator('article')
      .filter({ hasText: 'Initial garden' });
    await initial.getByRole('button', { name: 'Review restore' }).click();
    await expect(
      history.getByRole('heading', { name: /Restore “Initial garden”/ }),
    ).toBeVisible();
    await history
      .getByRole('button', { name: 'Publish restored revision' })
      .click();
    await expect(history).toHaveCount(0);
    await expect(
      page.getByRole('dialog', { name: 'Set up your garden' }),
    ).toBeVisible();

    state = await readWorkspace(page);
    expect(state.published.plan.setupCompleted).toBe(false);
    expect(state.revisions[0]?.changeSummary).toMatch(/^Restored /);
  });
});
