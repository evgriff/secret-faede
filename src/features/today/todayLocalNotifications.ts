import type { Garden } from '../../domain/gardens/GardenRepository';
import type { MobileDeviceService } from '../../domain/mobile/MobileDeviceService';
import { delayHarvestReminder } from './todayHarvestActions';

type ApplyGardenUpdate = (
  updateGarden: (current: Garden) => Garden,
  fallback?: string,
  options?: { refreshWateringFromSnapshot?: boolean },
) => Promise<boolean>;

export async function delayHarvestReminderWithLocalNotification({
  applyGardenUpdate,
  delayUntilDate,
  garden,
  mobileDeviceService,
  plantingId,
  reason,
}: {
  applyGardenUpdate: ApplyGardenUpdate;
  delayUntilDate: string;
  garden: Garden | null;
  mobileDeviceService: MobileDeviceService;
  plantingId: string;
  reason: string;
}) {
  const plantingLabel =
    garden?.plantings.find((planting) => planting.id === plantingId)?.label ??
    'this crop';
  const saved = await applyGardenUpdate(
    (current) =>
      delayHarvestReminder(current, {
        delayUntilDate,
        plantingId,
        reason,
      }),
    'Unable to reschedule harvest.',
  );

  if (!saved || !mobileDeviceService.getCapabilities().localNotifications) {
    return saved;
  }

  await scheduleHarvestDelayLocalNotification({
    delayUntilDate,
    mobileDeviceService,
    plantingLabel,
  }).catch(() => undefined);

  return saved;
}

export function scheduleHarvestDelayLocalNotification({
  delayUntilDate,
  mobileDeviceService,
  plantingLabel,
}: {
  delayUntilDate: string;
  mobileDeviceService: MobileDeviceService;
  plantingLabel: string;
}) {
  const scheduleAtIso = getMorningScheduleIso(delayUntilDate);

  if (!scheduleAtIso) {
    return Promise.resolve({
      message: 'Invalid local notification date.',
      status: 'unavailable' as const,
    });
  }

  return mobileDeviceService.scheduleLocalNotification({
    body: `Check ${plantingLabel} for harvest. Log harvest or choose Not ready again from Today.`,
    id: createLocalNotificationId(`harvest-${plantingLabel}-${delayUntilDate}`),
    scheduleAtIso,
    title: `Check harvest: ${plantingLabel}`,
  });
}

function getMorningScheduleIso(localDate: string) {
  const date = new Date(`${localDate}T08:00:00`);

  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function createLocalNotificationId(seed: string) {
  let hash = 0;

  for (const char of seed) {
    hash = (hash * 31 + char.charCodeAt(0)) % 2_147_483_647;
  }

  return Math.max(1, hash);
}
