import { expect, test, type Page } from '@playwright/test';

import {
  enterDemoFromShell,
  openPlanTool,
  savePlan,
  signInWithMockPassword,
} from './appSmokeHelpers';

test('Today surfaces due tasks with reasons and target jumps', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1365, height: 768 });
  await page.clock.setFixedTime(new Date('2026-06-21T14:00:00.000Z'));
  await signInWithMockPassword(page);
  await enterDemoFromShell(page);

  await page.goto('/app/today');
  await expect(
    page.getByRole('heading', { name: 'Checks and other work' }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Watering work' }),
  ).toBeVisible();
  await expect(page.getByText('roots and salad bed').first()).toBeVisible();
  await expect(
    page
      .getByText('Spring greens bed is below its weekly water target.')
      .first(),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Harvest schedule' }),
  ).toBeVisible();
  const radishHarvest = page
    .locator('article')
    .filter({ has: page.getByRole('button', { name: 'Log harvest' }) })
    .filter({ hasText: 'French breakfast radish' })
    .first();
  await expect(
    radishHarvest.getByRole('button', { name: 'Log harvest' }),
  ).toBeVisible();
  const doNow = page
    .getByRole('heading', { name: /field priorities/ })
    .locator('xpath=ancestor::section[1]');
  await expect(
    doNow.getByRole('button', { name: 'Water all done' }).first(),
  ).toHaveAttribute('data-ui', 'action');
  await expect(
    doNow.locator('[data-ui="status"]').filter({ hasText: 'Water all done' }),
  ).toHaveCount(0);
  await expect(doNow).not.toContainText('Log harvest');
  await doNow.getByRole('button', { name: 'Water all done' }).first().click();
  await expect(page.getByRole('region', { name: 'Add photo' })).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: 'Task done' }).first(),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Snooze' }).first(),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Defer' }).first(),
  ).toBeVisible();

  await page.getByRole('button', { name: /Jun 24/ }).click();
  await expect(
    page
      .locator('article')
      .filter({ has: page.getByRole('button', { name: 'Log harvest' }) })
      .filter({ hasText: 'French breakfast radish' })
      .first(),
  ).toBeVisible();
  await page.getByRole('button', { name: /Jun 22/ }).click();
  await expect(
    page.getByText('Inspect lettuce for slug pressure').first(),
  ).toBeVisible();
  await page
    .locator('article')
    .filter({ hasText: 'Inspect lettuce for slug pressure' })
    .getByRole('link', { name: 'Feed' })
    .first()
    .click();
  await expect(page).toHaveURL('/app/feed?entry=journal-demo-issue-slugs');
  await expect(
    page.getByRole('heading', {
      exact: true,
      name: 'Slug pressure in lettuce',
    }),
  ).toBeVisible();
  await page
    .locator('#feed-journal-demo-issue-slugs')
    .getByRole('link', { name: 'Butterhead lettuce' })
    .click();
  await expect(page).toHaveURL('/app/plan?p=demo-lettuce-block');
  await expect(
    page.getByRole('complementary', { name: 'Crop focus' }),
  ).toHaveCount(0);
  await expect(
    page.getByRole('button', {
      name: /Butterhead lettuce group, 9 plants at X:/,
    }),
  ).toBeVisible();
});

test('Today keeps the remaining watering deficit visible after a partial watering', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.clock.setFixedTime(new Date('2026-06-21T14:00:00.000Z'));
  await signInWithMockPassword(page);
  await enterDemoFromShell(page);

  await page.goto('/app/today');

  const wateringCard = page
    .locator('article')
    .filter({ hasText: 'roots and salad bed' })
    .filter({ has: page.getByRole('button', { name: 'Review watering' }) })
    .first();

  await wateringCard.getByRole('button', { name: 'Review watering' }).click();
  await expect(
    page.getByRole('dialog', { name: 'Review watering' }),
  ).toBeVisible();
  await page
    .getByRole('dialog', { name: 'Review watering' })
    .getByRole('button', { name: 'Partial watering' })
    .first()
    .click();
  await expect(
    page.getByRole('dialog', { name: 'Partial watering' }),
  ).toBeVisible();
  await page
    .getByRole('spinbutton', { name: 'Amount applied (inches)' })
    .fill('0.15');
  await page.getByRole('button', { name: 'Save partial watering' }).click();

  await expect(
    page.getByText('Partial watering logged in Feed.'),
  ).toBeVisible();
  await expect(wateringCard).toContainText('0.20 in still due');
  await expect(page.getByRole('dialog', { name: 'Add photo' })).toHaveCount(0);
});

test('Today refreshes Detroit NWS weather without stale impossible rain totals', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1365, height: 768 });
  await page.clock.setFixedTime(new Date('2026-04-24T23:30:00.000Z'));
  let weatherRun: 'first' | 'second' = 'first';

  await routeAnnArborNwsWeather(page, () => weatherRun);
  await signInWithMockPassword(page);
  await openPlanTool(page, 'Plant');
  await page.getByRole('button', { name: 'Open plant picker' }).click();
  await page.getByRole('searchbox', { name: 'Search crops' }).fill('tomato');
  await page.getByRole('button', { exact: true, name: 'Tomato crop' }).click();
  await page.getByRole('button', { exact: true, name: 'Add plant' }).click();
  await savePlan(page);
  await expect(page.getByText('Saved', { exact: true })).toBeVisible();

  await page.goto('/app/today');
  await page.getByRole('button', { name: 'Mark planted' }).click();
  await expect(page.getByText('Crop status updated.')).toBeVisible();
  await page
    .getByRole('button', { name: 'Refresh weather & watering schedule' })
    .click();

  await expect(
    page.getByText('Weather and watering schedule refreshed.'),
  ).toBeVisible();
  await expect(page.getByText('0.17in')).toBeVisible();
  await expect(page.getByText('500in')).toHaveCount(0);
  await expect(
    page.getByRole('heading', { name: 'Watering work' }),
  ).toHaveCount(0);
  const weatherPanel = page
    .getByRole('heading', { name: 'Field weather' })
    .locator('xpath=ancestor::section[1]');
  await expect(weatherPanel).toContainText(
    /No watering today|Next water window|Rain likely covers this week/,
  );
  await expect(weatherPanel).toContainText('Week rain');
  await expect(weatherPanel).toContainText(
    '78% rain chance; amount not published by NWS.',
  );
  await expect(weatherPanel).not.toContainText('Next likely');

  weatherRun = 'second';
  await page
    .getByRole('button', { name: 'Refresh weather & watering schedule' })
    .click();

  await expect(page.getByText('0.02in')).toBeVisible();
  await expect(page.getByText('500in')).toHaveCount(0);

  await page.getByRole('button', { name: /Sat Apr 25/ }).click();
  await expect(page.getByText('Mostly Cloudy')).toBeVisible();
  await expect(page.getByText('60F')).toBeVisible();
  await expect(page.getByText('0.08in')).toBeVisible();
  await expect(page.getByText('Forecast for')).toBeVisible();

  await page.getByRole('button', { name: /Sun Apr 26/ }).click();
  await expect(page.getByText('Mostly Sunny')).toBeVisible();
  await expect(page.getByText('64F')).toBeVisible();
  await expect(page.getByText('Light Rain')).toHaveCount(0);
});

test('Today harvest logging opens a dismissable sheet from the field card', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.clock.setFixedTime(new Date('2026-06-21T14:00:00.000Z'));
  await signInWithMockPassword(page);
  await enterDemoFromShell(page);

  await page.goto('/app/today');
  const radishHarvest = page
    .locator('article')
    .filter({ has: page.getByRole('button', { name: 'Log harvest' }) })
    .filter({ hasText: 'French breakfast radish' })
    .first();

  await radishHarvest.getByRole('button', { name: 'Log harvest' }).click();

  const harvestDialog = page.getByRole('dialog', { name: 'Log harvest' });
  await expect(harvestDialog).toBeVisible();
  await harvestDialog
    .getByRole('button', { name: 'Close quick action' })
    .click();
  await expect(harvestDialog).toHaveCount(0);

  await radishHarvest.getByRole('button', { name: 'Log harvest' }).click();
  await expect(harvestDialog).toBeVisible();
  await harvestDialog.getByRole('button', { name: 'Save harvest' }).click();

  await expect(page.getByText('Harvest saved to Feed.')).toBeVisible();
  await expect(page.getByRole('dialog', { name: 'Add photo' })).toHaveCount(0);
  await expect(radishHarvest).toContainText('French breakfast radish');
});

async function routeAnnArborNwsWeather(
  page: Page,
  getRun: () => 'first' | 'second',
) {
  await page.route('https://api.weather.gov/**', async (route) => {
    const url = route.request().url();

    if (url.includes('/points/42.3314,-83.0458')) {
      await route.fulfill({
        json: {
          properties: {
            forecast: 'https://api.weather.gov/gridpoints/DTX/42,30/forecast',
            forecastGridData: 'https://api.weather.gov/gridpoints/DTX/42,30',
            forecastHourly:
              'https://api.weather.gov/gridpoints/DTX/42,30/forecast/hourly',
            observationStations:
              'https://api.weather.gov/gridpoints/DTX/42,30/stations',
          },
        },
      });
      return;
    }

    if (url.endsWith('/gridpoints/DTX/42,30/stations')) {
      await route.fulfill({
        json: {
          features: [
            {
              properties: {
                name: 'Detroit City Airport',
                stationIdentifier: 'KARB',
              },
            },
          ],
        },
      });
      return;
    }

    if (url.endsWith('/stations/KARB/observations/latest')) {
      await route.fulfill({
        json: {
          properties: {
            heatIndex: { value: null },
            precipitationLastHour: {
              unitCode: 'wmoUnit:mm',
              value: getRun() === 'first' ? 1 : 0.5,
            },
            relativeHumidity: { value: 86 },
            temperature: { value: 18 },
            textDescription: 'Light Rain',
            timestamp: '2026-04-24T23:00:00+00:00',
            windSpeed: { value: 8 },
          },
        },
      });
      return;
    }

    if (url.includes('/stations/KARB/observations?')) {
      await route.fulfill({
        json: {
          features:
            getRun() === 'first'
              ? [
                  createNwsObservation('2026-04-24T20:53:00+00:00', 1),
                  createNwsObservation('2026-04-24T20:39:00+00:00', 0.1),
                  createNwsObservation('2026-04-24T14:53:00+00:00', 3.3),
                  createNwsObservation('2026-04-24T14:40:00+00:00', 3),
                ]
              : [createNwsObservation('2026-04-24T20:53:00+00:00', 0.5)],
        },
      });
      return;
    }

    if (url.endsWith('/gridpoints/DTX/42,30/forecast')) {
      await route.fulfill({
        json: {
          properties: {
            periods: [
              createNwsForecastPeriod(
                'Tonight',
                '2026-04-24T19:00:00-04:00',
                '2026-04-25T06:00:00-04:00',
                false,
                51,
                83,
                'Showers And Thunderstorms then Patchy Fog',
              ),
              createNwsForecastPeriod(
                'Saturday',
                '2026-04-25T06:00:00-04:00',
                '2026-04-25T18:00:00-04:00',
                true,
                60,
                1,
                'Mostly Cloudy',
              ),
              createNwsForecastPeriod(
                'Saturday Night',
                '2026-04-25T18:00:00-04:00',
                '2026-04-26T06:00:00-04:00',
                false,
                40,
                3,
                'Partly Cloudy',
              ),
              createNwsForecastPeriod(
                'Sunday',
                '2026-04-26T06:00:00-04:00',
                '2026-04-26T18:00:00-04:00',
                true,
                64,
                2,
                'Mostly Sunny',
              ),
              createNwsForecastPeriod(
                'Tuesday',
                '2026-04-28T06:00:00-04:00',
                '2026-04-28T18:00:00-04:00',
                true,
                72,
                78,
                'Rain Showers Likely',
              ),
            ],
          },
        },
      });
      return;
    }

    if (url.endsWith('/gridpoints/DTX/42,30/forecast/hourly')) {
      await route.fulfill({
        json: {
          properties: {
            periods: [
              {
                endTime: '2026-04-25T00:00:00+00:00',
                isDaytime: false,
                probabilityOfPrecipitation: { value: 20 },
                shortForecast: 'Cloudy',
                startTime: '2026-04-24T23:00:00+00:00',
                temperature: 64,
              },
            ],
          },
        },
      });
      return;
    }

    if (url.endsWith('/gridpoints/DTX/42,30')) {
      await route.fulfill({
        json: {
          properties: {
            probabilityOfPrecipitation: {
              values: [
                {
                  validTime: '2026-04-28T06:00:00+00:00/PT6H',
                  value: 78,
                },
              ],
            },
            quantitativePrecipitation: {
              values: [
                {
                  validTime: '2026-04-25T12:00:00+00:00/PT6H',
                  value: 2.032,
                },
              ],
            },
          },
        },
      });
      return;
    }

    if (url.includes('/alerts/active')) {
      await route.fulfill({
        json: {
          features: [],
        },
      });
      return;
    }

    await route.fulfill({ status: 404 });
  });
}

function createNwsForecastPeriod(
  name: string,
  startTime: string,
  endTime: string,
  isDaytime: boolean,
  temperature: number,
  precipitationChancePercent: number,
  shortForecast: string,
) {
  return {
    endTime,
    isDaytime,
    name,
    probabilityOfPrecipitation: {
      unitCode: 'wmoUnit:percent',
      value: precipitationChancePercent,
    },
    shortForecast,
    startTime,
    temperature,
  };
}

function createNwsObservation(timestamp: string, value: number) {
  return {
    properties: {
      precipitationLastHour: {
        unitCode: 'wmoUnit:mm',
        value,
      },
      timestamp,
    },
  };
}
