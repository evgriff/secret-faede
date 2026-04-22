import type {
  NotificationAlertType,
  NotificationChannel,
  NotificationConsent,
  NotificationType,
} from '../../domain/gardens/GardenRepository';

export const alertTypes: NotificationAlertType[] = [
  'watering',
  'frost',
  'heatStress',
  'severeWeather',
  'taskDue',
];

export function readNumber(value: string, fallback: number) {
  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : fallback;
}

export function formatChannel(channel: NotificationChannel) {
  switch (channel) {
    case 'inApp':
      return 'In-app';
    case 'push':
      return 'Push';
  }
}

export function formatAlertType(alertType: NotificationAlertType) {
  switch (alertType) {
    case 'frost':
      return 'Frost';
    case 'heatStress':
      return 'Heat stress';
    case 'severeWeather':
      return 'Severe weather';
    case 'taskDue':
      return 'Task due';
    case 'watering':
      return 'Watering';
  }
}

export function formatNotificationType(type: NotificationType) {
  if (type === 'task') {
    return 'Task';
  }

  if (type === 'weather') {
    return 'Weather';
  }

  return formatAlertType(type);
}

export function createConsent(
  status: NotificationConsent['status'],
  now: string,
): NotificationConsent {
  return {
    consentCopyVersion: '2026-04-20',
    grantedAtIso: status === 'granted' ? now : null,
    revokedAtIso: status === 'revoked' || status === 'denied' ? now : null,
    status,
  };
}

export function formatDateTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

export function toErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}
