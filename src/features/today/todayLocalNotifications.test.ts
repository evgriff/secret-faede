import {
  createDefaultGarden,
  createDefaultPlanting,
  type Garden,
} from '../../domain/gardens/GardenRepository';
import { MockMobileDeviceService } from '../../infrastructure/mock/mobile/mockMobileDeviceService';
import { delayHarvestReminderWithLocalNotification } from './todayLocalNotifications';

describe('todayLocalNotifications', () => {
  it('reschedules not-ready harvests and schedules a native local reminder when available', async () => {
    let garden: Garden = {
      ...createDefaultGarden('user-a'),
      plantings: [
        {
          ...createDefaultPlanting({
            id: 'tomato-1',
            label: 'Tomato',
            xFt: 2,
            yFt: 2,
          }),
          status: 'harvest-ready',
        },
      ],
    };
    const mobileDeviceService = new MockMobileDeviceService({
      isNative: true,
      localNotifications: true,
    });

    await delayHarvestReminderWithLocalNotification({
      applyGardenUpdate: async (updateGarden) => {
        garden = updateGarden(garden);
        return true;
      },
      delayUntilDate: '2026-06-24',
      garden,
      mobileDeviceService,
      plantingId: 'tomato-1',
      reason: 'Checked Tomato on 2026-06-21; not ready. Recheck 3 days.',
    });

    expect(garden.tasks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          dueDate: '2026-06-24',
          plantingId: 'tomato-1',
          type: 'harvest',
        }),
      ]),
    );
    expect(mobileDeviceService.scheduledLocalNotifications).toEqual([
      expect.objectContaining({
        body: expect.stringContaining('Check Tomato for harvest'),
        scheduleAtIso: expect.any(String),
        title: 'Check harvest: Tomato',
      }),
    ]);
  });
});
