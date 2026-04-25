import {
  appendPlantingEvent,
  createDefaultGarden,
  createDefaultPlanting,
} from '../../domain/gardens/GardenRepository';
import { buildSunShadeLayers } from '../garden/sunShadeEngine';
import { synchronizeGardenTasks } from '../tasks/taskEngine';
import { buildCropFocusSummary } from './planCropFocus';

describe('buildCropFocusSummary', () => {
  it('shows last work and event-driven next steps for the selected planting', () => {
    const gardenWithPlanting = {
      ...createDefaultGarden('user-a'),
      plantings: [
        appendPlantingEvent(
          {
            ...createDefaultPlanting({
              id: 'tomato-1',
              label: 'Tomato',
              xFt: 3,
              yFt: 3,
            }),
            cropId: 'tomato',
          },
          {
            occurredOn: '2026-04-22',
            type: 'directSowed',
          },
        ),
      ],
    };
    const garden = synchronizeGardenTasks(gardenWithPlanting, {
      now: new Date('2026-04-22T14:00:00.000Z'),
    });
    const sunLayer = buildSunShadeLayers(garden)[0];

    if (!sunLayer) {
      throw new Error('Expected a generated sun layer.');
    }

    const summary = buildCropFocusSummary({
      garden,
      selectedItem: { id: 'tomato-1', type: 'planting' },
      sunLayer,
      todayDate: '2026-04-22',
      warnings: [],
    });

    expect(summary?.selected.lastWork).toBe('Direct sowed on 2026-04-22');
    expect(summary?.needs.tasks).toEqual(
      expect.arrayContaining([
        'Set support for Tomato coming 2026-04-29',
        'Mulch Tomato coming 2026-05-02',
      ]),
    );
    expect(summary?.needs.harvest).toBe(
      'Expected harvest starts around Jul 6.',
    );
  });
});
