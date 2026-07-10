import { expect, type Locator, type Page } from '@playwright/test';

export const primaryEmail = 'primary.gardener@example.com';
export const partnerEmail = 'partner.gardener@example.com';

const workspaceKey = 'secret-faeries:v2:workspace';

export async function resetBrowserState(page: Page) {
  await page.goto('/sign-in');
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  await page.context().clearCookies();
  await page.goto('/sign-in');
  await expect(
    page.getByRole('heading', { name: 'Open the field book' }),
  ).toBeVisible();
}

export async function signIn(
  page: Page,
  options: { email?: string; remember?: boolean; reset?: boolean } = {},
) {
  if (options.reset !== false) await resetBrowserState(page);
  await page.getByLabel('Email').fill(options.email ?? primaryEmail);
  await page.getByLabel(/^Password/).fill('password');
  const remember = page.getByRole('checkbox', {
    name: 'Keep me signed in on this trusted device',
  });
  if ((options.remember ?? true) !== (await remember.isChecked())) {
    await remember.click();
  }
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(
    page.getByRole('navigation', { name: 'Garden workspace' }).first(),
  ).toBeVisible();
}

export async function createGarden(
  page: Page,
  options: {
    depthFt?: number;
    name?: string;
    template?: 'Blank plot' | 'Containers' | 'Raised bed';
    widthFt?: number;
  } = {},
) {
  await signIn(page);
  const setup = page.getByRole('dialog', { name: 'Set up your garden' });
  await expect(setup).toBeVisible();
  await setup.getByLabel('Garden name').fill(options.name ?? 'E2E garden');
  await setup.getByLabel('Width in feet').fill(String(options.widthFt ?? 20));
  await setup.getByLabel('Depth in feet').fill(String(options.depthFt ?? 14));
  await setup
    .getByRole('radio', {
      name: new RegExp(`^${options.template ?? 'Raised bed'}`),
    })
    .check();
  await fillGardenEnvironment(setup);
  await setup.getByRole('button', { name: 'Create garden plan' }).click();
  await expect(setup).toHaveCount(0);
  await expect(
    page.getByRole('heading', { name: options.name ?? 'E2E garden' }),
  ).toBeVisible();
}

export async function fillGardenEnvironment(setup: Locator) {
  await setup.getByLabel('Location label').fill('Detroit test garden');
  await setup.getByLabel('Weather location description').fill('Detroit, MI');
  await setup.getByLabel('Latitude').fill('42.3314');
  await setup.getByLabel('Longitude').fill('-83.0458');
  await setup.getByLabel('Garden timezone').fill('America/Detroit');
  await setup.getByLabel('Hardiness zone').fill('6b');
  await setup.getByLabel('Typical last frost').fill('04-30');
  await setup.getByLabel('Typical first frost').fill('10-15');
}

export async function addCropGroup(
  page: Page,
  cropName: string,
  options: {
    arrangement?:
      | 'Block'
      | 'Cluster'
      | 'Row'
      | 'Single / spaced'
      | 'Trellis line';
    growingArea?: string;
    lifecycle?: 'Growing' | 'Harvest ready' | 'Planned' | 'Planted';
    quantity?: number;
  } = {},
) {
  await page.getByRole('button', { name: 'Add crop' }).click();
  const dialog = page.getByRole('dialog', { name: 'Add a crop group' });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel('Search crops').fill(cropName);
  await dialog
    .getByRole('radio', {
      name: new RegExp(`^${escapeRegExp(cropName)}\\b`, 'i'),
    })
    .first()
    .check();
  await dialog
    .getByLabel('Number of plants')
    .fill(String(options.quantity ?? 1));
  if (options.arrangement) {
    await dialog.getByLabel('Arrangement').selectOption({
      label: options.arrangement,
    });
  }
  if (options.growingArea) {
    await dialog.getByLabel('Growing area').selectOption({
      label: options.growingArea,
    });
  }
  await dialog.getByRole('button', { name: 'Add crop group' }).click();
  await expect(dialog).toHaveCount(0);

  const cropButton = page.getByRole('button', {
    name: new RegExp(`^${escapeRegExp(cropName)} group,`),
  });
  await expect(cropButton).toBeVisible();
  if (options.lifecycle) {
    await page
      .getByLabel('Lifecycle')
      .selectOption({ label: options.lifecycle });
  }
  return cropButton;
}

export async function saveDraft(page: Page) {
  const save = page.getByRole('button', { name: 'Save draft' });
  await expect(save).toBeEnabled();
  await save.click();
  await expect(page.getByText('All changes saved').first()).toBeVisible();
}

export async function publishDraft(
  page: Page,
  changeSummary = 'Published by the browser journey',
) {
  const before = await readWorkspace(page);
  const publish = page.getByRole('button', { exact: true, name: 'Publish' });
  await expect(publish).toBeEnabled();
  await publish.click();

  const dialog = page.getByRole('dialog', {
    name: 'Publish this private draft?',
  });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel('Change summary').fill(changeSummary);
  await dialog.getByRole('button', { name: 'Publish shared plan' }).click();
  await expect(dialog).toHaveCount(0);
  await expect
    .poll(async () => (await readWorkspace(page)).published.revisionId)
    .not.toBe(before.published.revisionId);
  await expect
    .poll(async () => Object.keys((await readWorkspace(page)).drafts).length)
    .toBe(0);
}

export async function openWorkspaceRoute(
  page: Page,
  route: 'Feed' | 'Plan' | 'Settings' | 'Today',
) {
  const link = page
    .getByRole('navigation', { name: 'Garden workspace' })
    .getByRole('link', { exact: true, name: route });
  await link.filter({ visible: true }).click();
  await expect(page).toHaveURL(new RegExp(`/app/${route.toLowerCase()}$`));
  if (route === 'Plan') {
    await expect(
      page.getByRole('region', { name: 'Garden plot editor' }),
    ).toBeVisible();
  } else {
    await expect(
      page.getByRole('heading', { exact: true, level: 1, name: route }),
    ).toBeVisible();
  }
}

export async function readWorkspace(page: Page): Promise<MockWorkspaceState> {
  return page.evaluate((key) => {
    const value = localStorage.getItem(key);
    if (!value) throw new Error('The mock workspace has not been initialized.');
    return JSON.parse(value) as MockWorkspaceState;
  }, workspaceKey);
}

export async function seedTodayTask(
  page: Page,
  input: { cropGroupId: string; cropName: string; id?: string },
) {
  const id = input.id ?? 'e2e-tie-crop';
  await page.evaluate(
    ({ cropGroupId, cropName, id, key }) => {
      const state = JSON.parse(localStorage.getItem(key) ?? '{}');
      const now = new Date().toISOString();
      const dateParts = new Intl.DateTimeFormat('en-US', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      })
        .formatToParts(new Date())
        .reduce<Record<string, string>>((parts, part) => {
          parts[part.type] = part.value;
          return parts;
        }, {});
      const dueOn = `${dateParts.year}-${dateParts.month}-${dateParts.day}`;
      state.tasks = [
        {
          completedAtIso: null,
          createdAtIso: now,
          dueOn,
          id,
          kind: 'support',
          notes: 'Use the soft ties in the shed.',
          priority: 'high',
          reason: 'Keep stems upright before the next wind.',
          sourceId: cropGroupId,
          status: 'open',
          target: { id: cropGroupId, kind: 'plantingGroup', label: cropName },
          title: `Tie ${cropName.toLowerCase()}`,
          updatedAtIso: now,
        },
      ];
      localStorage.setItem(key, JSON.stringify(state));
    },
    {
      cropGroupId: input.cropGroupId,
      cropName: input.cropName,
      id,
      key: workspaceKey,
    },
  );
  return id;
}

export async function expectNoHorizontalOverflow(page: Page) {
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth + 1,
      ),
    )
    .toBe(true);
}

export async function expectFocused(locator: Locator) {
  await expect
    .poll(() =>
      locator.evaluate((element) => element === document.activeElement),
    )
    .toBe(true);
}

export interface MockWorkspaceState {
  drafts: Record<string, { plan: MockPlan }>;
  harvests: Array<Record<string, unknown>>;
  journal: Array<Record<string, unknown>>;
  published: { plan: MockPlan; revisionId: string };
  revisions: Array<{ changeSummary: string; revisionId: string }>;
  tasks: Array<Record<string, unknown>>;
  waterApplications: Array<Record<string, unknown>>;
  wateringRecommendations: Array<Record<string, unknown>>;
}

interface MockPlan {
  name: string;
  plantings: Array<{
    cropName: string;
    id: string;
    lifecycle: string;
    xFt: number;
    yFt: number;
  }>;
  plot: { depthFt: number; widthFt: number };
  setupCompleted: boolean;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
