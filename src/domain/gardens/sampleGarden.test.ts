import { describe, expect, it } from 'vitest';

import { findPlanWarnings } from '../../features/garden/gardenPlanning';
import { findSunShadeLayer } from '../../features/garden/sunShadeEngine';
import {
  createSampleGarden,
  createSampleUserProfile,
  sampleGardenName,
} from './sampleGarden';
import { getPlantingInstances } from './plantingInstances';

describe('sample garden fixture', () => {
  it('builds a stable Detroit demo with planning, operations, and log content', () => {
    const garden = createSampleGarden(
      'demo-user',
      new Date('2026-04-20T12:00:00.000Z'),
    );
    const warnings = findPlanWarnings(garden, {
      now: new Date('2026-04-20T12:00:00.000Z'),
      sunLayer: findSunShadeLayer(garden, 'summer'),
      sunSeason: 'summer',
    });

    expect(garden.name).toBe(sampleGardenName);
    expect(garden.plot.location.locationName).toBe('Detroit, MI');
    expect(garden.structures).toHaveLength(5);
    expect(garden.structures.map((structure) => structure.type)).not.toContain(
      'treeObstacle',
    );
    expect(garden.structures.map((structure) => structure.type)).not.toContain(
      'waterSource',
    );
    expect(garden.structures.map((structure) => structure.type)).not.toContain(
      'compost',
    );
    expect(garden.plantings.length).toBeGreaterThanOrEqual(9);
    expect(garden.seasonPlan.wantedCrops).toHaveLength(4);
    expect(
      garden.plantings.filter((planting) => planting.status === 'growing'),
    ).toHaveLength(2);
    expect(
      garden.plantings
        .filter((planting) => planting.status !== 'harvested')
        .reduce(
          (total, planting) => total + getPlantingInstances(planting).length,
          0,
        ),
    ).toBeLessThanOrEqual(65);
    expect(
      garden.plantings
        .filter((planting) => planting.status !== 'harvested')
        .every(
          (planting) =>
            getPlantingInstances(planting).length ===
            Math.max(planting.plantCount ?? 1, 1),
        ),
    ).toBe(true);
    const radishPlanting = garden.plantings.find(
      (planting) => planting.id === 'demo-radish-row',
    );
    const pepperPlanting = garden.plantings.find(
      (planting) => planting.id === 'demo-pepper-part-shade',
    );

    expect(
      radishPlanting ? getPlantingInstances(radishPlanting) : [],
    ).toHaveLength(14);
    expect(
      pepperPlanting ? getPlantingInstances(pepperPlanting) : [],
    ).toHaveLength(1);
    expect(
      garden.plantings
        .filter((planting) => planting.status === 'planned')
        .some((planting) => planting.notes.includes('[auto-layout]')),
    ).toBe(true);
    expect(garden.wateringSchedule).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          lastWateredAtIso: '2026-04-17T12:20:00.000Z',
          nextRecalculationAtIso: '2026-04-21T07:15:00.000Z',
          status: 'due',
          targetLabel: 'Roots and salad bed',
          urgency: 'high',
          wateringZoneId: 'zone-a',
        }),
      ]),
    );
    expect(garden.tasks.filter((task) => task.status === 'open').length).toBe(
      5,
    );
    expect(garden.tasks.map((task) => task.type)).not.toContain('harvest');
    expect(garden.journalEntries.some((entry) => entry.type === 'issue')).toBe(
      true,
    );
    expect(
      garden.journalEntries.filter((entry) => entry.photos.length > 0).length,
    ).toBeGreaterThanOrEqual(2);
    expect(
      garden.journalEntries.some(
        (entry) =>
          entry.title === 'Radish harvest before heat' &&
          entry.plantingId === 'demo-radish-row',
      ),
    ).toBe(true);
    expect(
      garden.journalEntries.some(
        (entry) =>
          entry.title === 'Watered Roots and salad bed' &&
          entry.weatherSnapshotId === 'demo-weather-today' &&
          entry.body.startsWith('Applied 0.3 in to Roots and salad bed.'),
      ),
    ).toBe(true);
    expect(garden.harvestEvents.length).toBeGreaterThanOrEqual(3);
    expect(garden.notificationLogs.length).toBeGreaterThanOrEqual(3);
    expect(garden.notificationLogs.map((log) => log.channel)).not.toContain(
      'retiredDelivery',
    );
    expect(garden.sunShadeLayers).toHaveLength(3);
    expect(
      findSunShadeLayer(garden, 'summer').areas.some(
        (area) => area.source === 'manual',
      ),
    ).toBe(true);
    expect(
      garden.sunShadeLayers
        .flatMap((layer) => layer.areas)
        .flatMap((area) => area.shadeSources ?? [])
        .map((source) => source.kind),
    ).not.toContain('treeObstacle');
    expect(warnings.map((warning) => warning.kind)).toEqual(
      expect.arrayContaining(['pathway', 'rotation', 'sun', 'trellis']),
    );
    expect(warnings.map((warning) => warning.title)).not.toContain(
      'Spacing collision',
    );
    expect(warnings.length).toBeLessThanOrEqual(7);
  });

  it('prefills coherent Detroit alert defaults without retired delivery state', () => {
    const profile = createSampleUserProfile('demo-user', 'grower@example.com');

    expect(profile.displayName).toBe('Demo gardener');
    expect(profile.alertLocationQuery).toBe('Detroit, MI');
    expect(profile.notificationPreference.defaultWateringCheckTime).toBe(
      '07:15',
    );
    expect(profile.notificationPreference.channels.inApp).toBe(true);
    expect(profile.notificationPreference.channels).not.toHaveProperty('email');
    expect(profile.notificationPreference.channels).not.toHaveProperty(
      'retiredDelivery',
    );
    expect(profile.notificationPreference.channelConsent).not.toHaveProperty(
      'email',
    );
    expect(profile.notificationPreference).not.toHaveProperty('phoneE164');
  });
});
